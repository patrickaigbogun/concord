defmodule ConcordApi.Repo.Migrations.CreateConcordSchema do
  use Ecto.Migration

  def change do
    # 1. USERS
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :username, :string, null: false
      add :display_name, :string, null: false
      add :email, :string, null: false
      add :avatar_url, :string
      add :bio, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:users, [:username])
    create unique_index(:users, [:email])

    # 2. REALMS
    create table(:realms, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :slug, :string, null: false
      add :description, :text
      add :icon_url, :string
      add :banner_url, :string
      add :visibility, :string, default: "public", null: false
      add :rules_checklist, :map, default: "[]", null: false

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:realms, [:slug])

    # 3. REALM MEMBERS (Separate Realm Membership & Waiting Room)
    create table(:realm_members, primary_key: false) do
      add :realm_id, references(:realms, on_delete: :delete_all, type: :binary_id), primary_key: true
      add :user_id, references(:users, on_delete: :delete_all, type: :binary_id), primary_key: true
      add :is_curator, :boolean, default: false, null: false
      add :status, :string, default: "admitted", null: false # admitted | waiting_room | declined
      add :admitted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:realm_members, [:realm_id, :status])
    create index(:realm_members, [:user_id])

    # 4. SPACES
    create table(:spaces, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :realm_id, references(:realms, on_delete: :nilify_all, type: :binary_id)
      add :name, :string, null: false
      add :slug, :string, null: false
      add :description, :text
      add :icon_url, :string
      add :kind, :string, default: "community", null: false # direct | group | community | organization
      add :visibility, :string, default: "public", null: false # public | unlisted | private | direct
      add :echo_policy, :string, default: "universal", null: false # space_only | realm_only | universal
      add :enabled_views, {:array, :string}, default: ["conversation", "posts", "files", "media"], null: false
      add :realm_agreement_status, :string, default: "none", null: false # none | pending | agreed | rejected
      add :realm_agreed_rules, {:array, :string}, default: [], null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:spaces, [:realm_id])
    create index(:spaces, [:slug])

    # 5. SPACE MEMBERS (Contextual Tag & Persona)
    create table(:space_members, primary_key: false) do
      add :space_id, references(:spaces, on_delete: :delete_all, type: :binary_id), primary_key: true
      add :user_id, references(:users, on_delete: :delete_all, type: :binary_id), primary_key: true
      add :tag, :string # Contextual handle in this space for mentions
      add :display_name, :string # Optional override
      add :avatar_url, :string # Optional override
      add :is_curator, :boolean, default: false, null: false
      add :is_anonymous, :boolean, default: false, null: false
      add :joined_at, :utc_datetime_usec, null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:space_members, [:space_id, :tag])
    create index(:space_members, [:user_id])

    # 6. MESSAGES (Continuous Chat)
    create table(:messages, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :space_id, references(:spaces, on_delete: :delete_all, type: :binary_id), null: false
      add :author_id, references(:users, on_delete: :nilify_all, type: :binary_id), null: false
      add :content, :text, null: false
      add :reply_to_id, references(:messages, on_delete: :nilify_all, type: :binary_id)
      add :type, :string, default: "text", null: false
      add :edited_at, :utc_datetime_usec
      add :deleted_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:messages, [:space_id, :inserted_at])
    create index(:messages, [:author_id])

    # 7. REACTIONS
    create table(:reactions, primary_key: false) do
      add :message_id, references(:messages, on_delete: :delete_all, type: :binary_id), primary_key: true
      add :user_id, references(:users, on_delete: :delete_all, type: :binary_id), primary_key: true
      add :emoji, :string, primary_key: true

      timestamps(type: :utc_datetime_usec)
    end

    # 8. POSTS (Deliberately Published Content)
    create table(:posts, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :space_id, references(:spaces, on_delete: :delete_all, type: :binary_id), null: false
      add :author_id, references(:users, on_delete: :nilify_all, type: :binary_id), null: false
      add :title, :string, null: false
      add :body, :text, null: false
      add :echo_policy, :string, default: "universal", null: false
      add :original_post_id, references(:posts, on_delete: :nilify_all, type: :binary_id)
      add :echo_source_space_id, references(:spaces, on_delete: :nilify_all, type: :binary_id)
      add :echo_count, :integer, default: 0, null: false
      add :comment_count, :integer, default: 0, null: false
      add :published_at, :utc_datetime_usec, null: false
      add :edited_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:posts, [:space_id, :published_at])
    create index(:posts, [:original_post_id])
    create index(:posts, [:author_id])

    # 9. COMMENTS (Structured Discussion around Posts)
    create table(:comments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :post_id, references(:posts, on_delete: :delete_all, type: :binary_id), null: false
      add :author_id, references(:users, on_delete: :nilify_all, type: :binary_id), null: false
      add :parent_comment_id, references(:comments, on_delete: :delete_all, type: :binary_id)
      add :content, :text, null: false
      add :edited_at, :utc_datetime_usec

      timestamps(type: :utc_datetime_usec)
    end

    create index(:comments, [:post_id, :inserted_at])
    create index(:comments, [:parent_comment_id])

    # 10. FILE ASSETS (Media & Documents)
    create table(:file_assets, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :space_id, references(:spaces, on_delete: :delete_all, type: :binary_id), null: false
      add :uploader_id, references(:users, on_delete: :nilify_all, type: :binary_id), null: false
      add :filename, :string, null: false
      add :content_type, :string, null: false
      add :size_bytes, :bigint, null: false
      add :url, :string, null: false
      add :preview_url, :string
      add :metadata, :map, default: "{}", null: false

      timestamps(type: :utc_datetime_usec)
    end

    create index(:file_assets, [:space_id, :inserted_at])
  end
end
