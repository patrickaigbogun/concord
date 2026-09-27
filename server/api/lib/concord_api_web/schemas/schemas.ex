defmodule ConcordApiWeb.Schemas do
  @moduledoc """
  OpenApiSpex schemas for Concord API models and request/response DTOs.
  """
  alias OpenApiSpex.Schema

  # --- User ---
  defmodule User do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "User",
      description: "A Concord user profile",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid, description: "Unique UUIDv7"},
        username: %Schema{type: :string, description: "Unique global handle"},
        display_name: %Schema{type: :string, description: "Display name"},
        avatar_url: %Schema{type: :string, nullable: true, description: "Avatar URL"},
        bio: %Schema{type: :string, nullable: true, description: "Bio text"},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :username, :display_name]
    })
  end

  defmodule CreateUserRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "CreateUserRequest",
      type: :object,
      properties: %{
        username: %Schema{type: :string},
        display_name: %Schema{type: :string},
        email: %Schema{type: :string, format: :email},
        avatar_url: %Schema{type: :string, nullable: true},
        bio: %Schema{type: :string, nullable: true}
      },
      required: [:username, :display_name, :email]
    })
  end

  # --- Realm ---
  defmodule Realm do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "Realm",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        name: %Schema{type: :string},
        slug: %Schema{type: :string},
        description: %Schema{type: :string, nullable: true},
        icon_url: %Schema{type: :string, nullable: true},
        banner_url: %Schema{type: :string, nullable: true},
        visibility: %Schema{type: :string, enum: ["public", "unlisted", "private"]},
        rules_checklist: %Schema{type: :array, items: %Schema{type: :object}},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :name, :slug, :visibility]
    })
  end

  defmodule CreateRealmRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "CreateRealmRequest",
      type: :object,
      properties: %{
        name: %Schema{type: :string},
        slug: %Schema{type: :string},
        description: %Schema{type: :string, nullable: true},
        icon_url: %Schema{type: :string, nullable: true},
        banner_url: %Schema{type: :string, nullable: true},
        visibility: %Schema{type: :string, enum: ["public", "unlisted", "private"], default: "public"},
        rules_checklist: %Schema{type: :array, items: %Schema{type: :object}, default: []}
      },
      required: [:name, :slug]
    })
  end

  # --- Space ---
  defmodule Space do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "Space",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        realm_id: %Schema{type: :string, format: :uuid, nullable: true},
        name: %Schema{type: :string},
        slug: %Schema{type: :string},
        description: %Schema{type: :string, nullable: true},
        icon_url: %Schema{type: :string, nullable: true},
        kind: %Schema{type: :string, enum: ["direct", "group", "community", "organization"]},
        visibility: %Schema{type: :string, enum: ["public", "unlisted", "private", "direct"]},
        echo_policy: %Schema{type: :string, enum: ["space_only", "realm_only", "universal"]},
        enabled_views: %Schema{type: :array, items: %Schema{type: :string}},
        realm_agreement_status: %Schema{type: :string, enum: ["none", "pending", "agreed", "rejected"]},
        realm_agreed_rules: %Schema{type: :array, items: %Schema{type: :string}},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :name, :slug, :kind, :visibility, :echo_policy, :enabled_views]
    })
  end

  defmodule CreateSpaceRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "CreateSpaceRequest",
      type: :object,
      properties: %{
        realm_id: %Schema{type: :string, format: :uuid, nullable: true},
        name: %Schema{type: :string},
        slug: %Schema{type: :string},
        description: %Schema{type: :string, nullable: true},
        icon_url: %Schema{type: :string, nullable: true},
        kind: %Schema{type: :string, enum: ["direct", "group", "community", "organization"], default: "community"},
        visibility: %Schema{type: :string, enum: ["public", "unlisted", "private", "direct"], default: "public"},
        echo_policy: %Schema{type: :string, enum: ["space_only", "realm_only", "universal"], default: "universal"},
        enabled_views: %Schema{type: :array, items: %Schema{type: :string}, default: ["conversation", "posts", "files", "media"]}
      },
      required: [:name, :slug]
    })
  end

  defmodule ContextualIdentityRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "ContextualIdentityRequest",
      type: :object,
      properties: %{
        tag: %Schema{type: :string, description: "Contextual Space-specific handle"},
        display_name: %Schema{type: :string, nullable: true},
        avatar_url: %Schema{type: :string, nullable: true},
        is_anonymous: %Schema{type: :boolean, default: false}
      }
    })
  end

  # --- Message (Chat) ---
  defmodule Message do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "Message",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        space_id: %Schema{type: :string, format: :uuid},
        author: %Schema{type: :object, description: "Author user object"},
        content: %Schema{type: :string},
        reply_to_id: %Schema{type: :string, format: :uuid, nullable: true},
        type: %Schema{type: :string, enum: ["text", "file", "media", "system"]},
        edited_at: %Schema{type: :string, format: :"date-time", nullable: true},
        deleted_at: %Schema{type: :string, format: :"date-time", nullable: true},
        reactions: %Schema{type: :array, items: %Schema{type: :object}},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :space_id, :content, :type, :inserted_at]
    })
  end

  defmodule CreateMessageRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "CreateMessageRequest",
      type: :object,
      properties: %{
        content: %Schema{type: :string},
        reply_to_id: %Schema{type: :string, format: :uuid, nullable: true},
        type: %Schema{type: :string, enum: ["text", "file", "media", "system"], default: "text"}
      },
      required: [:content]
    })
  end

  # --- Post & Comment ---
  defmodule Post do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "Post",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        space_id: %Schema{type: :string, format: :uuid},
        author: %Schema{type: :object},
        title: %Schema{type: :string},
        body: %Schema{type: :string},
        echo_policy: %Schema{type: :string, enum: ["space_only", "realm_only", "universal"]},
        original_post_id: %Schema{type: :string, format: :uuid, nullable: true},
        echo_source_space_id: %Schema{type: :string, format: :uuid, nullable: true},
        echo_count: %Schema{type: :integer},
        comment_count: %Schema{type: :integer},
        published_at: %Schema{type: :string, format: :"date-time"},
        edited_at: %Schema{type: :string, format: :"date-time", nullable: true},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :space_id, :title, :body, :published_at]
    })
  end

  defmodule CreatePostRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "CreatePostRequest",
      type: :object,
      properties: %{
        title: %Schema{type: :string},
        body: %Schema{type: :string},
        echo_policy: %Schema{type: :string, enum: ["space_only", "realm_only", "universal"], default: "universal"}
      },
      required: [:title, :body]
    })
  end

  defmodule Comment do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "Comment",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        post_id: %Schema{type: :string, format: :uuid},
        author: %Schema{type: :object},
        parent_comment_id: %Schema{type: :string, format: :uuid, nullable: true},
        content: %Schema{type: :string},
        edited_at: %Schema{type: :string, format: :"date-time", nullable: true},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :post_id, :content, :inserted_at]
    })
  end

  defmodule CreateCommentRequest do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "CreateCommentRequest",
      type: :object,
      properties: %{
        parent_comment_id: %Schema{type: :string, format: :uuid, nullable: true},
        content: %Schema{type: :string}
      },
      required: [:content]
    })
  end

  # --- FileAsset ---
  defmodule FileAsset do
    require OpenApiSpex
    OpenApiSpex.schema(%{
      title: "FileAsset",
      type: :object,
      properties: %{
        id: %Schema{type: :string, format: :uuid},
        space_id: %Schema{type: :string, format: :uuid},
        uploader: %Schema{type: :object},
        filename: %Schema{type: :string},
        content_type: %Schema{type: :string},
        size_bytes: %Schema{type: :integer},
        url: %Schema{type: :string},
        preview_url: %Schema{type: :string, nullable: true},
        metadata: %Schema{type: :object},
        inserted_at: %Schema{type: :string, format: :"date-time"}
      },
      required: [:id, :space_id, :filename, :content_type, :size_bytes, :url]
    })
  end
end
