defmodule ConcordApiWeb.FileController do
  use ConcordApiWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ConcordApi.Media
  alias ConcordApiWeb.Schemas

  tags ["Files & Media"]

  operation :index_files,
    summary: "List files and documents in a Space (Files tab)",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Files list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.FileAsset}}
    ]

  def index_files(conn, %{"space_id" => space_id}) do
    files = Media.list_files(space_id)
    json(conn, files)
  end

  operation :index_media,
    summary: "List photos and videos in a Space (Media tab)",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Media gallery list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.FileAsset}}
    ]

  def index_media(conn, %{"space_id" => space_id}) do
    media = Media.list_media(space_id)
    json(conn, media)
  end

  operation :create,
    summary: "Register an uploaded file asset",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true],
      user_id: [in: :header, description: "Uploader User ID", type: :string, required: true]
    ],
    request_body: {"File asset metadata", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{
        filename: %OpenApiSpex.Schema{type: :string},
        content_type: %OpenApiSpex.Schema{type: :string},
        size_bytes: %OpenApiSpex.Schema{type: :integer},
        url: %OpenApiSpex.Schema{type: :string},
        preview_url: %OpenApiSpex.Schema{type: :string, nullable: true},
        metadata: %OpenApiSpex.Schema{type: :object}
      },
      required: [:filename, :content_type, :size_bytes, :url]
    }},
    responses: [
      created: {"Created file asset", "application/json", Schemas.FileAsset},
      unprocessable_entity: {"Validation errors", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def create(conn, %{"space_id" => space_id} = params) do
    user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]

    if user_id do
      attrs = Map.merge(params, %{"space_id" => space_id, "uploader_id" => user_id})
      case Media.create_file_asset(attrs) do
        {:ok, file_asset} ->
          conn |> put_status(:created) |> json(file_asset)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end
end
