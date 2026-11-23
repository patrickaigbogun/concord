defmodule ConcordApi.Accounts do
  @moduledoc """
  The Accounts context for managing user identity and syncing with Concord ID (`id.dexx.systems`).
  """

  import Ecto.Query, warn: false
  alias ConcordApi.Repo
  alias ConcordApi.Accounts.User

  def list_users do
    Repo.all(User)
  end

  def get_user!(id), do: Repo.get!(User, id)

  def get_user(id) when is_binary(id) do
    case Ecto.UUID.cast(id) do
      {:ok, uuid} -> Repo.get(User, uuid)
      :error -> nil
    end
  end

  def get_user_by_username(username) when is_binary(username) do
    Repo.get_by(User, username: username)
  end

  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  def create_user(attrs \\ %{}) do
    %User{}
    |> User.changeset(attrs)
    |> Repo.insert()
  end

  def update_user(%User{} = user, attrs) do
    user
    |> User.changeset(attrs)
    |> Repo.update()
  end

  def delete_user(%User{} = user) do
    Repo.delete(user)
  end

  def change_user(%User{} = user, attrs \\ %{}) do
    User.changeset(user, attrs)
  end

  @doc """
  Upserts a user record in the local Chat database from verified Concord ID claims.
  Ensures foreign keys (`author_id`, `user_id`, `uploader_id`) always resolve to the exact Concord ID UUID.
  """
  def sync_concord_user(%{"sub" => id} = claims) when is_binary(id) do
    username = claims["preferred_username"] || claims["username"]
    display_name = claims["name"] || claims["display_name"] || username
    email = claims["email"] || "#{username}@id.dexx.systems"
    avatar_url = claims["picture"] || claims["avatar_url"]
    bio = claims["bio"]

    attrs = %{
      "id" => id,
      "username" => username,
      "display_name" => display_name,
      "email" => email,
      "avatar_url" => avatar_url,
      "bio" => bio
    }

    case get_user(id) || get_user_by_username(username) || get_user_by_email(email) do
      nil ->
        %User{}
        |> User.sync_changeset(attrs)
        |> Repo.insert()

      %User{} = existing ->
        existing
        |> User.sync_changeset(Map.delete(attrs, "id"))
        |> Repo.update()
    end
  end

  @doc """
  Verifies a Bearer JWT against Concord ID (`/oauth/userinfo`) and syncs the user locally.
  """
  def verify_and_sync_token(token) when is_binary(token) and token != "" do
    id_base_url = System.get_env("CONCORD_ID_URL", "http://127.0.0.1:4001") |> String.trim_trailing("/")

    case Req.get("#{id_base_url}/oauth/userinfo", headers: [{"authorization", "Bearer #{token}"}], receive_timeout: 5_000) do
      {:ok, %Req.Response{status: 200, body: body}} when is_map(body) ->
        sync_concord_user(body)

      _ ->
        {:error, :unauthorized}
    end
  end
  def verify_and_sync_token(_), do: {:error, :unauthorized}
end
