defmodule ConcordApiWeb.Plugs.ConcordAuth do
  @moduledoc """
  Plug that authenticates incoming requests via Concord ID (`id.dexx.systems`) or HMAC-signed
  Gateway headers (`X-Gateway-Timestamp` + `X-Gateway-Signature`), strips untrusted identity
  headers to prevent spoofing, auto-syncs the user into the local Chat database, and assigns
  `current_user_id`.
  """
  import Plug.Conn
  alias ConcordApi.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    gateway_secret = System.get_env("GATEWAY_SHARED_SECRET", "")
    ts_str = get_req_header(conn, "x-gateway-timestamp") |> List.first() || ""
    sig = get_req_header(conn, "x-gateway-signature") |> List.first() || ""

    raw_uid = get_req_header(conn, "x-user-id") |> List.first() || ""
    raw_uname = get_req_header(conn, "x-username") |> List.first() || ""
    raw_dname = get_req_header(conn, "x-display-name") |> List.first()
    raw_email = get_req_header(conn, "x-email") |> List.first()
    raw_avatar = get_req_header(conn, "x-avatar-url") |> List.first()

    trusted_gateway? =
      valid_gateway_signature?(gateway_secret, ts_str, sig, conn.method, conn.request_path, raw_uid)

    # Always strip incoming identity & gateway signature headers first
    conn =
      conn
      |> delete_req_header("x-user-id")
      |> delete_req_header("x-username")
      |> delete_req_header("x-display-name")
      |> delete_req_header("x-email")
      |> delete_req_header("x-avatar-url")
      |> delete_req_header("x-gateway-secret")
      |> delete_req_header("x-gateway-timestamp")
      |> delete_req_header("x-gateway-signature")

    cond do
      # 1. Verified HMAC-signed Gateway headers
      trusted_gateway? and raw_uid != "" and raw_uname != "" ->
        claims = %{
          "sub" => raw_uid,
          "preferred_username" => raw_uname,
          "name" => raw_dname || raw_uname,
          "email" => raw_email || "#{raw_uname}@id.dexx.systems",
          "picture" => raw_avatar
        }

        case Accounts.sync_concord_user(claims) do
          {:ok, user} -> assign_authenticated_user(conn, user)
          _ -> conn
        end

      # 2. Direct Bearer token -> verify against Concord ID (/oauth/userinfo) & sync user
      token = extract_bearer_token(conn) ->
        case Accounts.verify_and_sync_token(token) do
          {:ok, user} -> assign_authenticated_user(conn, user)
          _ -> conn
        end

      # 3. Test-only opt-in bypass for ExUnit suites
      Application.get_env(:concord_api, :trust_test_user_header, false) and raw_uid != "" ->
        conn
        |> assign(:current_user_id, raw_uid)
        |> put_req_header("x-user-id", raw_uid)

      true ->
        conn
    end
  end

  defp valid_gateway_signature?("", _ts, _sig, _method, _path, _uid), do: false
  defp valid_gateway_signature?(_secret, "", _sig, _method, _path, _uid), do: false
  defp valid_gateway_signature?(_secret, _ts, "", _method, _path, _uid), do: false

  defp valid_gateway_signature?(secret, ts_str, sig, method, path, uid) do
    now = System.system_time(:second)

    with {ts, ""} <- Integer.parse(ts_str),
         true <- abs(now - ts) <= 30 do
      payload = "#{ts_str}:#{String.upcase(method)}:#{path}:#{uid}"
      expected = :crypto.mac(:hmac, :sha256, secret, payload) |> Base.encode16(case: :lower)
      Plug.Crypto.secure_compare(expected, sig)
    else
      _ -> false
    end
  end

  defp assign_authenticated_user(conn, user) do
    conn
    |> assign(:current_user, user)
    |> assign(:current_user_id, user.id)
    |> put_req_header("x-user-id", user.id)
  end

  defp extract_bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token | _] -> String.trim(token)
      ["bearer " <> token | _] -> String.trim(token)
      _ -> nil
    end
  end
end
