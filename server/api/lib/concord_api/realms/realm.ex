defmodule ConcordApi.Realms.Realm do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [:id, :name, :slug, :description, :icon_url, :banner_url, :visibility, :rules_checklist, :inserted_at]}

  schema "realms" do
    field :name, :string
    field :slug, :string
    field :description, :string
    field :icon_url, :string
    field :banner_url, :string
    field :visibility, :string, default: "public"
    field :rules_checklist, {:array, :map}, default: []

    has_many :realm_members, ConcordApi.Realms.RealmMember
    has_many :spaces, ConcordApi.Spaces.Space

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(realm, attrs) do
    realm
    |> cast(attrs, [:name, :slug, :description, :icon_url, :banner_url, :visibility, :rules_checklist])
    |> validate_required([:name, :slug])
    |> validate_inclusion(:visibility, ["public", "unlisted", "private"])
    |> unique_constraint(:slug)
  end
end
