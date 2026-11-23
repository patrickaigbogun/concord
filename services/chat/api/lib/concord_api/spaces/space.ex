defmodule ConcordApi.Spaces.Space do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [
    :id, :realm_id, :name, :slug, :description, :icon_url,
    :kind, :visibility, :echo_policy, :enabled_views,
    :realm_agreement_status, :realm_agreed_rules, :inserted_at
  ]}

  schema "spaces" do
    belongs_to :realm, ConcordApi.Realms.Realm
    field :name, :string
    field :slug, :string
    field :description, :string
    field :icon_url, :string
    field :kind, :string, default: "community" # direct | group | community | organization
    field :visibility, :string, default: "public" # public | unlisted | private | direct
    field :echo_policy, :string, default: "universal" # space_only | realm_only | universal
    field :enabled_views, {:array, :string}, default: ["conversation", "posts", "files", "media"]
    field :realm_agreement_status, :string, default: "none" # none | pending | agreed | rejected
    field :realm_agreed_rules, {:array, :string}, default: []

    has_many :space_members, ConcordApi.Spaces.SpaceMember
    has_many :messages, ConcordApi.Conversations.Message
    has_many :posts, ConcordApi.Posts.Post

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(space, attrs) do
    space
    |> cast(attrs, [
      :realm_id, :name, :slug, :description, :icon_url,
      :kind, :visibility, :echo_policy, :enabled_views,
      :realm_agreement_status, :realm_agreed_rules
    ])
    |> validate_required([:name, :slug])
    |> validate_inclusion(:kind, ["direct", "group", "community", "organization"])
    |> validate_inclusion(:visibility, ["public", "unlisted", "private", "direct"])
    |> validate_inclusion(:echo_policy, ["space_only", "realm_only", "universal"])
    |> validate_inclusion(:realm_agreement_status, ["none", "pending", "agreed", "rejected"])
  end
end
