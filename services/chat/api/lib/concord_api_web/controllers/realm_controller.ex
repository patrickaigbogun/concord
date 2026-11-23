defmodule ConcordApiWeb.RealmController do
  use ConcordApiWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ConcordApi.Realms
  alias ConcordApiWeb.Schemas

  tags ["Realms"]

  operation :index,
    summary: "List all realms",
    responses: [
      ok: {"Realms list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.Realm}}
    ]

  def index(conn, _params) do
    realms = Realms.list_realms()
    json(conn, realms)
  end

  operation :create,
    summary: "Create a new Realm",
    parameters: [
      user_id: [in: :header, description: "Creator User ID", type: :string, required: true]
    ],
    request_body: {"Realm attributes", "application/json", Schemas.CreateRealmRequest},
    responses: [
      created: {"Created Realm", "application/json", Schemas.Realm},
      unprocessable_entity: {"Validation errors", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def create(conn, params) do
    user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]

    if user_id do
      case Realms.create_realm(params, user_id) do
        {:ok, realm} ->
          conn |> put_status(:created) |> json(realm)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end

  operation :show,
    summary: "Get Realm by ID",
    parameters: [
      id: [in: :path, description: "Realm ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Realm", "application/json", Schemas.Realm},
      not_found: {"Not found", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def show(conn, %{"id" => id}) do
    case Realms.get_realm(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "Realm not found"})
      realm -> json(conn, realm)
    end
  end

  operation :join,
    summary: "Request admission to a Realm (enters Waiting Room)",
    parameters: [
      id: [in: :path, description: "Realm ID", type: :string, required: true]
    ],
    request_body: {"Join request", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{user_id: %OpenApiSpex.Schema{type: :string}},
      required: [:user_id]
    }},
    responses: [
      ok: {"Waiting room admission request", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def join(conn, %{"id" => realm_id, "user_id" => user_id}) do
    case Realms.request_realm_admission(realm_id, user_id) do
      {:ok, member} -> json(conn, member)
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end

  operation :admit,
    summary: "Admit a user from the Realm waiting room to active membership",
    parameters: [
      id: [in: :path, description: "Realm ID", type: :string, required: true]
    ],
    request_body: {"Admit user parameters", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{user_id: %OpenApiSpex.Schema{type: :string}},
      required: [:user_id]
    }},
    responses: [
      ok: {"Admitted member", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def admit(conn, %{"id" => realm_id, "user_id" => user_id}) do
    case Realms.admit_member(realm_id, user_id) do
      {:ok, member} -> json(conn, member)
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end

  operation :add_space,
    summary: "Federate / add an existing Space to this Realm",
    parameters: [
      id: [in: :path, description: "Realm ID", type: :string, required: true]
    ],
    request_body: {"Add space request", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{space_id: %OpenApiSpex.Schema{type: :string}},
      required: [:space_id]
    }},
    responses: [
      ok: {"Updated Space", "application/json", Schemas.Space}
    ]

  def add_space(conn, %{"id" => realm_id, "space_id" => space_id}) do
    case Realms.add_space_to_realm(realm_id, space_id) do
      {:ok, space} -> json(conn, space)
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end

  operation :agree_rules,
    summary: "Explicitly accept Realm rules checklist for a Space",
    parameters: [
      id: [in: :path, description: "Realm ID", type: :string, required: true],
      space_id: [in: :path, description: "Space ID", type: :string, required: true]
    ],
    request_body: {"Agreed rule IDs", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{agreed_rules: %OpenApiSpex.Schema{type: :array, items: %OpenApiSpex.Schema{type: :string}}},
      required: [:agreed_rules]
    }},
    responses: [
      ok: {"Updated Space with agreed rules", "application/json", Schemas.Space}
    ]

  def agree_rules(conn, %{"id" => _realm_id, "space_id" => space_id, "agreed_rules" => agreed_rules}) do
    case Realms.agree_to_realm_rules(space_id, agreed_rules) do
      {:ok, space} -> json(conn, space)
      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
    end
  end
end
