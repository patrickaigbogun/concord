defmodule ConcordApi.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [:id, :username, :display_name, :avatar_url, :bio, :inserted_at]}

  schema "users" do
    field :username, :string
    field :display_name, :string
    field :email, :string
    field :avatar_url, :string
    field :bio, :string

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:username, :display_name, :email, :avatar_url, :bio])
    |> validate_required([:username, :display_name, :email])
    |> validate_format(:email, ~r/^[^\s]+@[^\s]+$/, message: "must have the @ sign and no spaces")
    |> validate_length(:username, min: 2, max: 32)
    |> validate_format(:username, ~r/^[\p{L}\p{N}_.-]+$/u, message: "can only contain letters, numbers, and _.-")
    |> unique_constraint(:username)
    |> unique_constraint(:email)
  end

  @doc """
  Changeset used when syncing an authenticated user profile from Concord ID (`id.dexx.systems`).
  """
  def sync_changeset(user, attrs) do
    user
    |> cast(attrs, [:id, :username, :display_name, :email, :avatar_url, :bio])
    |> validate_required([:id, :username, :display_name, :email])
    |> unique_constraint(:id, name: :users_pkey)
    |> unique_constraint(:username)
    |> unique_constraint(:email)
  end
end
