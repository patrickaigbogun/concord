defmodule ConcordApiWeb.UserController do
  use ConcordApiWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ConcordApi.Accounts
  alias ConcordApiWeb.Schemas

  tags ["Users"]

  operation :index,
    summary: "List all users",
    responses: [
      ok: {"Users list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.User}}
    ]

  def index(conn, _params) do
    users = Accounts.list_users()
    json(conn, users)
  end

  operation :create,
    summary: "Create or register a user",
    request_body: {"User attributes", "application/json", Schemas.CreateUserRequest},
    responses: [
      created: {"Created user", "application/json", Schemas.User},
      unprocessable_entity: {"Validation errors", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def create(conn, params) do
    case Accounts.create_user(params) do
      {:ok, user} ->
        conn |> put_status(:created) |> json(user)
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end

  operation :show,
    summary: "Get user by ID",
    parameters: [
      id: [in: :path, description: "User ID", type: :string, required: true]
    ],
    responses: [
      ok: {"User", "application/json", Schemas.User},
      not_found: {"Not found", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def show(conn, %{"id" => id}) do
    case Accounts.get_user(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      user -> json(conn, user)
    end
  end

  operation :by_username,
    summary: "Get user by username handle",
    parameters: [
      username: [in: :path, description: "Username handle", type: :string, required: true]
    ],
    responses: [
      ok: {"User", "application/json", Schemas.User},
      not_found: {"Not found", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def by_username(conn, %{"username" => username}) do
    case Accounts.get_user_by_username(username) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "User not found"})
      user -> json(conn, user)
    end
  end
end
