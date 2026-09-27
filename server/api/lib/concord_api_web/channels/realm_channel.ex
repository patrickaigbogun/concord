defmodule ConcordApiWeb.RealmChannel do
  use ConcordApiWeb, :channel

  alias ConcordApi.Realms

  @impl true
  def join("realm:" <> realm_id, _payload, socket) do
    case Realms.get_realm(realm_id) do
      nil ->
        {:error, %{reason: "Realm not found"}}

      _realm ->
        socket = assign(socket, :realm_id, realm_id)
        {:ok, %{status: "connected", realm_id: realm_id}, socket}
    end
  end

  @impl true
  def handle_in("admit_member", %{"user_id" => user_id}, socket) do
    realm_id = socket.assigns.realm_id

    case Realms.admit_member(realm_id, user_id) do
      {:ok, member} ->
        broadcast!(socket, "member_admitted", %{
          realm_id: realm_id,
          user_id: user_id,
          status: member.status
        })
        {:reply, {:ok, %{status: "admitted"}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end
end
