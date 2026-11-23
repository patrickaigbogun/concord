defmodule ConcordApiWeb.UserSocket do
  use Phoenix.Socket

  channel "space:*", ConcordApiWeb.SpaceChannel
  channel "realm:*", ConcordApiWeb.RealmChannel

  @impl true
  def connect(%{"user_id" => user_id}, socket, _connect_info) do
    {:ok, assign(socket, :user_id, user_id)}
  end

  def connect(_params, socket, _connect_info) do
    # Allow guest/anonymous connection or pass through
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
