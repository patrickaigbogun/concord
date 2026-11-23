defmodule ConcordApiWeb.SpaceController do
  use ConcordApiWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ConcordApi.Spaces
  alias ConcordApiWeb.Schemas

  tags ["Spaces"]

  operation :index,
    summary: "List spaces",
    parameters: [
      realm_id: [in: :query, description: "Filter by Realm ID", type: :string, required: false]
    ],
    responses: [
      ok: {"Spaces list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.Space}}
    ]

  def index(conn, %{"realm_id" => realm_id}) do
    spaces = Spaces.list_realm_spaces(realm_id)
    json(conn, spaces)
  end

  def index(conn, _params) do
    spaces = Spaces.list_spaces()
    json(conn, spaces)
  end

  operation :create,
    summary: "Create a new Space",
    parameters: [
      user_id: [in: :header, description: "Creator User ID", type: :string, required: true]
    ],
    request_body: {"Space attributes", "application/json", Schemas.CreateSpaceRequest},
    responses: [
      created: {"Created Space", "application/json", Schemas.Space},
      unprocessable_entity: {"Validation errors", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def create(conn, params) do
    user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]
    tag = params["tag"] || params["username"]

    if user_id do
      case Spaces.create_space(params, user_id, tag) do
        {:ok, space} ->
          conn |> put_status(:created) |> json(space)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end

  operation :show,
    summary: "Get Space by ID",
    parameters: [
      id: [in: :path, description: "Space ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Space", "application/json", Schemas.Space},
      not_found: {"Not found", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def show(conn, %{"id" => id}) do
    case Spaces.get_space(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "Space not found"})
      space -> json(conn, space)
    end
  end

  operation :join,
    summary: "Join a Space with an optional contextual tag",
    parameters: [
      id: [in: :path, description: "Space ID", type: :string, required: true]
    ],
    request_body: {"Join parameters", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{
        user_id: %OpenApiSpex.Schema{type: :string},
        tag: %OpenApiSpex.Schema{type: :string, description: "Contextual persona handle in this space"}
      },
      required: [:user_id]
    }},
    responses: [
      ok: {"Space membership", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def join(conn, %{"id" => space_id, "user_id" => user_id} = params) do
    tag = params["tag"]
    case Spaces.join_space(space_id, user_id, tag) do
      {:ok, member} -> json(conn, member)
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end

  operation :update_identity,
    summary: "Update contextual tag/persona within a Space",
    parameters: [
      id: [in: :path, description: "Space ID", type: :string, required: true],
      user_id: [in: :header, description: "User ID", type: :string, required: true]
    ],
    request_body: {"Contextual identity overrides", "application/json", Schemas.ContextualIdentityRequest},
    responses: [
      ok: {"Updated persona", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def update_identity(conn, %{"id" => space_id} = params) do
    user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]
    if user_id do
      case Spaces.update_contextual_identity(space_id, user_id, params) do
        {:ok, member} -> json(conn, member)
        {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "Membership not found"})
        {:error, changeset} -> conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end
end
