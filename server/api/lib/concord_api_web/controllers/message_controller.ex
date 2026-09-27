defmodule ConcordApiWeb.MessageController do
  use ConcordApiWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ConcordApi.Conversations
  alias ConcordApiWeb.Schemas

  tags ["Messages"]

  operation :index,
    summary: "List continuous chat messages with cursor pagination",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true],
      before: [in: :query, description: "Cursor: return messages before this message ID", type: :string, required: false],
      after: [in: :query, description: "Cursor: return messages after this message ID", type: :string, required: false],
      limit: [in: :query, description: "Batch size limit (default: 50)", type: :integer, required: false]
    ],
    responses: [
      ok: {"Messages list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.Message}}
    ]

  def index(conn, %{"space_id" => space_id} = params) do
    opts = [
      before: params["before"],
      after: params["after"],
      limit: if(params["limit"], do: String.to_integer(params["limit"]), else: 50)
    ]
    messages = Conversations.list_messages(space_id, opts)
    json(conn, messages)
  end

  operation :create,
    summary: "Send a message to continuous chat stream",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true],
      user_id: [in: :header, description: "Author User ID", type: :string, required: true]
    ],
    request_body: {"Message content", "application/json", Schemas.CreateMessageRequest},
    responses: [
      created: {"Created message", "application/json", Schemas.Message},
      unprocessable_entity: {"Validation errors", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def create(conn, %{"space_id" => space_id} = params) do
    author_id = get_req_header(conn, "x-user-id") |> List.first() || params["author_id"]

    if author_id do
      attrs = Map.merge(params, %{"space_id" => space_id, "author_id" => author_id})
      case Conversations.create_message(attrs) do
        {:ok, message} ->
          message = Conversations.get_message!(message.id)

          # Broadcast on Phoenix PubSub / Channel
          ConcordApiWeb.Endpoint.broadcast("space:#{space_id}", "message_created", %{
            id: message.id,
            space_id: message.space_id,
            author_id: message.author_id,
            author: message.author && %{
              id: message.author.id,
              username: message.author.username,
              display_name: message.author.display_name,
              avatar_url: message.author.avatar_url
            },
            content: message.content,
            reply_to_id: message.reply_to_id,
            type: message.type,
            inserted_at: message.inserted_at
          })

          conn |> put_status(:created) |> json(message)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing author_id"})
    end
  end

  operation :add_reaction,
    summary: "Add emoji reaction to a message",
    parameters: [
      id: [in: :path, description: "Message ID", type: :string, required: true],
      user_id: [in: :header, description: "User ID", type: :string, required: true]
    ],
    request_body: {"Emoji payload", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{emoji: %OpenApiSpex.Schema{type: :string}},
      required: [:emoji]
    }},
    responses: [
      ok: {"Reaction added", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def add_reaction(conn, %{"id" => message_id, "emoji" => emoji} = params) do
    user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]

    if user_id do
      case Conversations.add_reaction(message_id, user_id, emoji) do
        {:ok, reaction} ->
          json(conn, reaction)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end

  operation :remove_reaction,
    summary: "Remove emoji reaction from a message",
    parameters: [
      id: [in: :path, description: "Message ID", type: :string, required: true],
      user_id: [in: :header, description: "User ID", type: :string, required: true],
      emoji: [in: :query, description: "Emoji string", type: :string, required: true]
    ],
    responses: [
      ok: {"Reaction removed", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def remove_reaction(conn, %{"id" => message_id, "emoji" => emoji} = params) do
    user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]

    if user_id do
      Conversations.remove_reaction(message_id, user_id, emoji)
      json(conn, %{status: "deleted"})
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end
end
