defmodule ConcordApi.Spaces.SpaceMember do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [:space_id, :user_id, :tag, :display_name, :avatar_url, :is_curator, :is_anonymous, :joined_at]}

  schema "space_members" do
    belongs_to :space, ConcordApi.Spaces.Space, primary_key: true
    belongs_to :user, ConcordApi.Accounts.User, primary_key: true
    field :tag, :string # Contextual handle in this space for mentions
    field :display_name, :string # Optional contextual override
    field :avatar_url, :string # Optional contextual override
    field :is_curator, :boolean, default: false
    field :is_anonymous, :boolean, default: false
    field :joined_at, :utc_datetime_usec

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(member, attrs) do
    member
    |> cast(attrs, [:space_id, :user_id, :tag, :display_name, :avatar_url, :is_curator, :is_anonymous, :joined_at])
    |> validate_required([:space_id, :user_id])
    |> foreign_key_constraint(:space_id)
    |> foreign_key_constraint(:user_id)
  end
end
