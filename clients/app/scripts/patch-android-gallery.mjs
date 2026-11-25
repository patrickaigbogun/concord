import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ANDROID_MAIN = path.join(ROOT, 'src-tauri', 'gen', 'android', 'app', 'src', 'main')
const PKG_DIR = path.join(ANDROID_MAIN, 'java', 'systems', 'dexx', 'concord')
const MANIFEST_PATH = path.join(ANDROID_MAIN, 'AndroidManifest.xml')
const GALLERY_BRIDGE_PATH = path.join(PKG_DIR, 'GalleryBridge.kt')
const MAIN_ACTIVITY_PATH = path.join(PKG_DIR, 'MainActivity.kt')

const GALLERY_BRIDGE_KT = `package systems.dexx.concord

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.util.Size
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

class GalleryBridge(
  private val activity: Activity,
  private val webView: WebView
) {
  companion object {
    const val GALLERY_PERMISSION_REQUEST_CODE = 4201
    private const val THUMB_SIZE = 240
    private const val THUMB_QUALITY = 72
  }

  private data class RawMedia(
    val id: Long,
    val uri: Uri,
    val filename: String,
    val mimeType: String,
    val kind: String,
    val sizeBytes: Long,
    val dateAdded: Long
  )

  private fun requiredPermissions(): Array<String> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO,
        Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      arrayOf(
        Manifest.permission.READ_MEDIA_IMAGES,
        Manifest.permission.READ_MEDIA_VIDEO
      )
    } else {
      arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
    }
  }

  @JavascriptInterface
  fun hasPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val images = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.READ_MEDIA_IMAGES
      ) == PackageManager.PERMISSION_GRANTED
      val videos = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.READ_MEDIA_VIDEO
      ) == PackageManager.PERMISSION_GRANTED
      val partial = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        ContextCompat.checkSelfPermission(
          activity,
          Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
        ) == PackageManager.PERMISSION_GRANTED
      } else {
        false
      }
      images || videos || partial
    } else {
      ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.READ_EXTERNAL_STORAGE
      ) == PackageManager.PERMISSION_GRANTED
    }
  }

  @JavascriptInterface
  fun requestPermission() {
    activity.runOnUiThread {
      if (hasPermission()) {
        webView.evaluateJavascript(
          "window.__concordGalleryPermResult && window.__concordGalleryPermResult(true)",
          null
        )
        return@runOnUiThread
      }
      ActivityCompat.requestPermissions(
        activity,
        requiredPermissions(),
        GALLERY_PERMISSION_REQUEST_CODE
      )
    }
  }

  @JavascriptInterface
  fun listMedia(limit: Int, offset: Int): String {
    if (!hasPermission()) return "[]"
    val safeLimit = limit.coerceIn(1, 200)
    val safeOffset = offset.coerceAtLeast(0)
    val fetchCap = safeOffset + safeLimit

    val combined = ArrayList<RawMedia>()
    queryCollection(
      collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
      kind = "image",
      defaultMime = "image/jpeg",
      maxRows = fetchCap,
      out = combined
    )
    queryCollection(
      collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
      kind = "video",
      defaultMime = "video/mp4",
      maxRows = fetchCap,
      out = combined
    )

    combined.sortByDescending { it.dateAdded }

    val page = if (safeOffset >= combined.size) {
      emptyList()
    } else {
      combined.subList(safeOffset, minOf(combined.size, safeOffset + safeLimit))
    }

    val result = JSONArray()
    for (item in page) {
      val thumbDataUrl = createThumbnailDataUrl(item.uri, item.kind)
      val obj = JSONObject()
      obj.put("id", "\${item.kind}-\${item.id}")
      obj.put("uri", item.uri.toString())
      obj.put("filename", item.filename)
      obj.put("mimeType", item.mimeType)
      obj.put("kind", item.kind)
      obj.put("thumbnailDataUrl", thumbDataUrl)
      obj.put("sizeBytes", item.sizeBytes)
      result.put(obj)
    }

    return result.toString()
  }

  @JavascriptInterface
  fun readMediaBase64(uriStr: String): String {
    if (!hasPermission()) return ""
    val maxBytes = 25L * 1024L * 1024L
    return try {
      val uri = Uri.parse(uriStr)
      val path = uri.path ?: return ""
      val isMediaUri = uri.scheme == "content" &&
        uri.authority == MediaStore.AUTHORITY &&
        Regex("^/external(_primary)?/(images|video)/media/\\\\d+$").matches(path)
      if (!isMediaUri) return ""

      val declaredSize = activity.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
      if (declaredSize > maxBytes) return ""

      val stream = activity.contentResolver.openInputStream(uri) ?: return ""
      stream.use { input ->
        val out = ByteArrayOutputStream()
        val buf = ByteArray(16384)
        var total = 0L
        while (true) {
          val read = input.read(buf)
          if (read <= 0) break
          total += read
          if (total > maxBytes) return ""
          out.write(buf, 0, read)
        }
        Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
      }
    } catch (_: Exception) {
      ""
    }
  }

  private fun queryCollection(
    collection: Uri,
    kind: String,
    defaultMime: String,
    maxRows: Int,
    out: MutableList<RawMedia>
  ) {
    val projection = arrayOf(
      MediaStore.MediaColumns._ID,
      MediaStore.MediaColumns.DISPLAY_NAME,
      MediaStore.MediaColumns.MIME_TYPE,
      MediaStore.MediaColumns.SIZE,
      MediaStore.MediaColumns.DATE_ADDED
    )
    val sortOrder = "\${MediaStore.MediaColumns.DATE_ADDED} DESC"
    try {
      activity.contentResolver.query(collection, projection, null, null, sortOrder)?.use { cursor ->
        val idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
        val nameCol = cursor.getColumnIndex(MediaStore.MediaColumns.DISPLAY_NAME)
        val mimeCol = cursor.getColumnIndex(MediaStore.MediaColumns.MIME_TYPE)
        val sizeCol = cursor.getColumnIndex(MediaStore.MediaColumns.SIZE)
        val dateCol = cursor.getColumnIndex(MediaStore.MediaColumns.DATE_ADDED)

        var count = 0
        while (cursor.moveToNext() && count < maxRows) {
          val id = cursor.getLong(idCol)
          val uri = ContentUris.withAppendedId(collection, id)
          val filename = if (nameCol >= 0) cursor.getString(nameCol) ?: "\$kind-\$id" else "\$kind-\$id"
          val mimeType = if (mimeCol >= 0) cursor.getString(mimeCol) ?: defaultMime else defaultMime
          val sizeBytes = if (sizeCol >= 0) cursor.getLong(sizeCol) else 0L
          val dateAdded = if (dateCol >= 0) cursor.getLong(dateCol) else 0L
          out.add(RawMedia(id, uri, filename, mimeType, kind, sizeBytes, dateAdded))
          count++
        }
      }
    } catch (_: Exception) {
      // Ignore collection query failures on restricted devices
    }
  }

  private fun createThumbnailDataUrl(uri: Uri, kind: String): String {
    var bitmap: Bitmap? = null
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        bitmap = activity.contentResolver.loadThumbnail(uri, Size(THUMB_SIZE, THUMB_SIZE), null)
      }
    } catch (_: Exception) {
      bitmap = null
    }

    if (bitmap == null && kind == "image") {
      bitmap = decodeSampledImage(uri, THUMB_SIZE, THUMB_SIZE)
    }

    if (bitmap == null) return ""

    return try {
      val baos = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.JPEG, THUMB_QUALITY, baos)
      val b64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
      "data:image/jpeg;base64,\$b64"
    } catch (_: Exception) {
      ""
    } finally {
      bitmap.recycle()
    }
  }

  private fun decodeSampledImage(uri: Uri, reqWidth: Int, reqHeight: Int): Bitmap? {
    return try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      activity.contentResolver.openInputStream(uri)?.use { stream ->
        BitmapFactory.decodeStream(stream, null, bounds)
      }
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

      var sampleSize = 1
      while ((bounds.outHeight / sampleSize) > reqHeight * 2 || (bounds.outWidth / sampleSize) > reqWidth * 2) {
        sampleSize *= 2
      }

      val opts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
      activity.contentResolver.openInputStream(uri)?.use { stream ->
        BitmapFactory.decodeStream(stream, null, opts)
      }
    } catch (_: Exception) {
      null
    }
  }
}
`

const MAIN_ACTIVITY_KT = `package systems.dexx.concord

import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private var concordWebView: WebView? = null
  private var galleryBridge: GalleryBridge? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    concordWebView = webView
    val bridge = GalleryBridge(this, webView)
    galleryBridge = bridge
    webView.addJavascriptInterface(bridge, "ConcordGallery")
  }

  @Deprecated("Deprecated in Java")
  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == GalleryBridge.GALLERY_PERMISSION_REQUEST_CODE) {
      val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED } ||
        (galleryBridge?.hasPermission() == true)
      concordWebView?.post {
        concordWebView?.evaluateJavascript(
          "window.__concordGalleryPermResult && window.__concordGalleryPermResult(\$granted)",
          null
        )
      }
    }
  }
}
`

function patchAndroidManifest() {
	if (!fs.existsSync(MANIFEST_PATH)) {
		throw new Error(`AndroidManifest.xml not found at ${MANIFEST_PATH}`)
	}
	let xml = fs.readFileSync(MANIFEST_PATH, 'utf8')
	const permissions = [
		'<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
		'<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />',
		'<uses-permission android:name="android.permission.READ_MEDIA_VISUAL_USER_SELECTED" />',
		'<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',
		'<uses-permission android:name="android.permission.RECORD_AUDIO" />',
		'<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
	]

	const missing = permissions.filter((line) => {
		const match = line.match(/android:name="([^"]+)"/)
		return match ? !xml.includes(match[1]) : false
	})

	if (missing.length > 0) {
		const injection = missing.map((p) => `    ${p}`).join('\n') + '\n'
		if (!xml.includes('<application')) {
			throw new Error('Could not find <application> tag in AndroidManifest.xml')
		}
		xml = xml.replace('<application', `${injection}    <application`)
		fs.writeFileSync(MANIFEST_PATH, xml, 'utf8')
		console.log(`[patch-android-gallery] Added ${missing.length} media permission(s) to AndroidManifest.xml`)
	} else {
		console.log('[patch-android-gallery] AndroidManifest.xml already has media permissions')
	}
}

function main() {
	if (!fs.existsSync(ANDROID_MAIN)) {
		throw new Error(`Android project not initialized at ${ANDROID_MAIN}. Run "bunx tauri android init --ci" first.`)
	}

	fs.mkdirSync(PKG_DIR, { recursive: true })
	fs.writeFileSync(GALLERY_BRIDGE_PATH, GALLERY_BRIDGE_KT, 'utf8')
	console.log(`[patch-android-gallery] Wrote ${GALLERY_BRIDGE_PATH}`)

	fs.writeFileSync(MAIN_ACTIVITY_PATH, MAIN_ACTIVITY_KT, 'utf8')
	console.log(`[patch-android-gallery] Patched ${MAIN_ACTIVITY_PATH}`)

	patchAndroidManifest()
}

main()
