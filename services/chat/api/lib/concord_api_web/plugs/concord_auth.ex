defmodule ConcordApiWeb.Plugs.ConcordAuth do
  @moduledoc """
  Plug that authenticates incoming requests via Concord ID (`id.dexx.systems`) or cryptographically
  authenticated Gateway headers (`X-Gateway-Secret`), strips untrusted identity headers to prevent
  spoofing, auto-syncs the user into the local Chat database, and assigns `current_user_id`.
  """
  import Plug.Conn
  alias ConcordApi.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    gateway_secret = System.get_env("GATEWAY_SHARED_SECRET", "")
    req_gateway_secret = get_req_header(conn, "x-gateway-secret") |> List.first() || ""

    trusted_gateway? =
      gateway_secret != "" and Plug.Crypto.secure_compare(gateway_secret, req_gateway_secret)

    raw_uid = get_req_header(conn, "x-user-id") |> List.first()
    raw_uname = get_req_header(conn, "x-username") |> List.first()
    raw_dname = get_req_header(conn, "x-display-name") |> List.first()
    raw_email = get_req_header(conn, "x-email") |> List.first()
    raw_avatar = get_req_header(conn, "x-avatar-url") |> List.first()

    # Always strip incoming identity headers first so unverified headers never leak downstream
    conn =
      conn
      |> delete_req_header("x-user-id")
      |> delete_req_header("x-username")
      |> delete_req_header("x-display-name")
      |> delete_req_header("x-email")
      |> delete_req_header("x-avatar-url")
      |> delete_req_header("x-gateway-secret")

    cond do
      # 1. Verified Gateway-forwarded identity headers (authenticated via shared secret)
      trusted_gateway? and is_binary(raw_uid) and raw_uid != "" and is_binary(raw_uname) and raw_uname != "" ->
        claims = %{
          "sub" => raw_uid,
          "preferred_username" => raw_uname,
          "name" => raw_dname || raw_uname,
          "email" => raw_email || "#{raw_uname}@id.dexx.systems",
          "picture" => raw_avatar
        }

        case Accounts.sync_concord_user(claims) do
          {:ok, user} -> assign_authenticated_user(conn, user)
          _ -> conn
        end

      # 2. Direct Bearer token -> verify against Concord ID (/oauth/userinfo) & sync user
      token = extract_bearer_token(conn) ->
        case Accounts.verify_and_sync_token(token) do
          {:ok, user} -> assign_authenticated_user(conn, user)
          _ -> conn
        end

      # 3. Test-only opt-in bypass for ExUnit suites
      Application.get_env(:concord_api, :trust_test_user_header, false) and is_binary(raw_uid) and raw_uid != "" ->
        conn
        |> assign(:current_user_id, raw_uid)
        |> put_req_header("x-user-id", raw_uid)

      true ->
        conn
    end
  end

  defp assign_authenticated_user(conn, user) do
    conn
    |> assign(:current_user, user)
    |> assign(:current_user_id, user.id)
    |> put_req_header("x-user-id", user.id)
  end

  defp extract_bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token | _] -> String.trim(token)
      ["bearer " <> token | _] -> String.trim(token)
      _ -> nil
    end
  end
end
