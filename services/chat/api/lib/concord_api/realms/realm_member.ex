defmodule ConcordApi.Realms.RealmMember do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [:realm_id, :user_id, :is_curator, :status, :admitted_at, :inserted_at]}

  schema "realm_members" do
    belongs_to :realm, ConcordApi.Realms.Realm, primary_key: true
    belongs_to :user, ConcordApi.Accounts.User, primary_key: true
    field :is_curator, :boolean, default: false
    field :status, :string, default: "admitted" # admitted | waiting_room | declined
    field :admitted_at, :utc_datetime_usec

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(member, attrs) do
    member
    |> cast(attrs, [:realm_id, :user_id, :is_curator, :status, :admitted_at])
    |> validate_required([:realm_id, :user_id])
    |> validate_inclusion(:status, ["admitted", "waiting_room", "declined"])
    |> foreign_key_constraint(:realm_id)
    |> foreign_key_constraint(:user_id)
  end
end
