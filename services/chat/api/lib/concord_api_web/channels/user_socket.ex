defmodule ConcordApiWeb.UserSocket do
  use Phoenix.Socket

  alias ConcordApi.Accounts

  channel "space:*", ConcordApiWeb.SpaceChannel
  channel "realm:*", ConcordApiWeb.RealmChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) when is_binary(token) and token != "" do
    case Accounts.verify_and_sync_token(token) do
      {:ok, user} ->
        socket =
          socket
          |> assign(:user_id, user.id)
          |> assign(:username, user.username)

        {:ok, socket}

      _ ->
        :error
    end
  end

  def connect(_params, socket, _connect_info) do
    # Anonymous / read-only socket connection (no :user_id assigned)
    {:ok, socket}
  end

  @impl true
  def id(socket) do
    case socket.assigns[:user_id] do
      nil -> nil
      user_id -> "user_socket:#{user_id}"
    end
  end
end
