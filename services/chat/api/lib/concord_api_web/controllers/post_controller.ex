defmodule ConcordApiWeb.PostController do
  use ConcordApiWeb, :controller
  use OpenApiSpex.ControllerSpecs

  alias ConcordApi.Posts
  alias ConcordApiWeb.Schemas

  tags ["Posts"]

  operation :index,
    summary: "List published posts in a Space (Posts Tab View)",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Posts list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.Post}}
    ]

  def index(conn, %{"space_id" => space_id}) do
    posts = Posts.list_posts(space_id)
    json(conn, posts)
  end

  operation :create,
    summary: "Publish a new Post in a Space",
    parameters: [
      space_id: [in: :path, description: "Space ID", type: :string, required: true],
      user_id: [in: :header, description: "Author User ID", type: :string, required: true]
    ],
    request_body: {"Post attributes", "application/json", Schemas.CreatePostRequest},
    responses: [
      created: {"Created post", "application/json", Schemas.Post},
      unprocessable_entity: {"Validation errors", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def create(conn, %{"space_id" => space_id} = params) do
    author_id = get_req_header(conn, "x-user-id") |> List.first() || params["author_id"]

    if author_id do
      attrs = Map.merge(params, %{"space_id" => space_id, "author_id" => author_id})
      case Posts.create_post(attrs) do
        {:ok, post} ->
          post = Posts.get_post!(post.id)
          ConcordApiWeb.Endpoint.broadcast("space:#{space_id}", "post_published", %{
            id: post.id,
            space_id: post.space_id,
            author_id: post.author_id,
            author: post.author && %{
              id: post.author.id,
              username: post.author.username,
              display_name: post.author.display_name,
              avatar_url: post.author.avatar_url
            },
            title: post.title,
            body: post.body,
            echo_policy: post.echo_policy,
            published_at: post.published_at,
            inserted_at: post.inserted_at
          })
          conn |> put_status(:created) |> json(post)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing author_id"})
    end
  end

  operation :show,
    summary: "Get a Post with comments and provenance",
    parameters: [
      id: [in: :path, description: "Post ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Post", "application/json", Schemas.Post},
      not_found: {"Not found", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def show(conn, %{"id" => id}) do
    case Posts.get_post(id) do
      nil -> conn |> put_status(:not_found) |> json(%{error: "Post not found"})
      post -> json(conn, post)
    end
  end

  operation :echo,
    summary: "Echo (share) a Post into another Space",
    parameters: [
      id: [in: :path, description: "Original Post ID", type: :string, required: true],
      user_id: [in: :header, description: "Sharing User ID", type: :string, required: true]
    ],
    request_body: {"Echo target", "application/json", %OpenApiSpex.Schema{
      type: :object,
      properties: %{
        destination_space_id: %OpenApiSpex.Schema{type: :string}
      },
      required: [:destination_space_id]
    }},
    responses: [
      created: {"Created Echo post", "application/json", Schemas.Post},
      forbidden: {"Echo policy violation", "application/json", %OpenApiSpex.Schema{type: :object}}
    ]

  def echo(conn, %{"id" => original_post_id, "destination_space_id" => destination_space_id} = params) do
    sharing_user_id = get_req_header(conn, "x-user-id") |> List.first() || params["user_id"]

    if sharing_user_id do
      case Posts.echo_post(original_post_id, destination_space_id, sharing_user_id) do
        {:ok, echo_post} ->
          echo_post = Posts.get_post!(echo_post.id)
          ConcordApiWeb.Endpoint.broadcast("space:#{destination_space_id}", "post_echoed", %{
            id: echo_post.id,
            space_id: echo_post.space_id,
            original_post_id: echo_post.original_post_id,
            echo_source_space_id: echo_post.echo_source_space_id,
            title: echo_post.title,
            author: echo_post.author && %{
              id: echo_post.author.id,
              username: echo_post.author.username,
              display_name: echo_post.author.display_name
            }
          })
          conn |> put_status(:created) |> json(echo_post)
        {:error, :echo_policy_violation} ->
          conn |> put_status(:forbidden) |> json(%{error: "Post echo policy forbids sharing beyond this boundary"})
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing user_id"})
    end
  end

  operation :index_comments,
    summary: "List comments on a Post",
    parameters: [
      post_id: [in: :path, description: "Post ID", type: :string, required: true]
    ],
    responses: [
      ok: {"Comments list", "application/json", %OpenApiSpex.Schema{type: :array, items: Schemas.Comment}}
    ]

  def index_comments(conn, %{"post_id" => post_id}) do
    comments = Posts.list_comments(post_id)
    json(conn, comments)
  end

  operation :create_comment,
    summary: "Post a comment on a published Post",
    parameters: [
      post_id: [in: :path, description: "Post ID", type: :string, required: true],
      user_id: [in: :header, description: "Author User ID", type: :string, required: true]
    ],
    request_body: {"Comment content", "application/json", Schemas.CreateCommentRequest},
    responses: [
      created: {"Created comment", "application/json", Schemas.Comment}
    ]

  def create_comment(conn, %{"post_id" => post_id} = params) do
    author_id = get_req_header(conn, "x-user-id") |> List.first() || params["author_id"]

    if author_id do
      attrs = Map.merge(params, %{"post_id" => post_id, "author_id" => author_id})
      case Posts.create_comment(attrs) do
        {:ok, comment} ->
          conn |> put_status(:created) |> json(comment)
        {:error, changeset} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)})
      end
    else
      conn |> put_status(:bad_request) |> json(%{error: "Missing author_id"})
    end
  end
end
