defmodule ConcordApiWeb.Plugs.ConcordAuth do
  @moduledoc """
  Plug that authenticates incoming requests via Concord ID (`id.dexx.systems`) or verified Gateway headers,
  auto-syncs the user into the local Chat database, and assigns `current_user` and `x-user-id`.
  """
  import Plug.Conn
  alias ConcordApi.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    cond do
      # 1. Bearer token present -> verify with Concord ID & sync user
      token = extract_bearer_token(conn) ->
        case Accounts.verify_and_sync_token(token) do
          {:ok, user} ->
            conn
            |> assign(:current_user, user)
            |> assign(:current_user_id, user.id)
            |> put_req_header("x-user-id", user.id)

          _ ->
            conn
        end

      # 2. Gateway-forwarded verified identity headers present -> sync user locally
      (uid = get_req_header(conn, "x-user-id") |> List.first()) &&
          (uname = get_req_header(conn, "x-username") |> List.first()) ->
        claims = %{
          "sub" => uid,
          "preferred_username" => uname,
          "name" => get_req_header(conn, "x-display-name") |> List.first() || uname,
          "email" => get_req_header(conn, "x-email") |> List.first() || "#{uname}@id.dexx.systems",
          "picture" => get_req_header(conn, "x-avatar-url") |> List.first()
        }

        case Accounts.sync_concord_user(claims) do
          {:ok, user} ->
            conn
            |> assign(:current_user, user)
            |> assign(:current_user_id, user.id)
            |> put_req_header("x-user-id", user.id)

          _ ->
            conn
        end

      true ->
        conn
    end
  end

  defp extract_bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token | _] -> String.trim(token)
      ["bearer " <> token | _] -> String.trim(token)
      _ -> nil
    end
  end
end
