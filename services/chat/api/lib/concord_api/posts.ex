defmodule ConcordApi.Posts do
  @moduledoc """
  The Posts context managing deliberately published Posts, Comments, and Echos.
  """

  import Ecto.Query, warn: false
  alias ConcordApi.Repo
  alias ConcordApi.Posts.{Post, Comment}
  alias ConcordApi.Spaces.Space

  def list_posts(space_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 25)

    from(p in Post,
      where: p.space_id == ^space_id,
      order_by: [desc: p.published_at],
      limit: ^limit,
      preload: [:author, :original_post, :echo_source_space]
    )
    |> Repo.all()
  end

  def get_post!(id) do
    Repo.get!(Post, id)
    |> Repo.preload([:author, :original_post, :echo_source_space, comments: :author])
  end

  def get_post(id) do
    case Repo.get(Post, id) do
      nil -> nil
      post -> Repo.preload(post, [:author, :original_post, :echo_source_space, comments: :author])
    end
  end

  def create_post(attrs \\ %{}) do
    attrs = Map.put_new(attrs, "published_at", DateTime.utc_now())

    %Post{}
    |> Post.changeset(attrs)
    |> Repo.insert()
  end

  def create_post(space_id, author_id, attrs) when is_binary(space_id) and is_binary(author_id) do
    attrs
    |> Map.put("space_id", space_id)
    |> Map.put("author_id", author_id)
    |> create_post()
  end

  def update_post(%Post{} = post, attrs) do
    attrs = Map.put(attrs, "edited_at", DateTime.utc_now())
    post
    |> Post.changeset(attrs)
    |> Repo.update()
  end

  def delete_post(%Post{} = post) do
    Repo.delete(post)
  end

  # Echo System (Post Sharing across Spaces)
  def echo_post(original_post_id, destination_space_id, sharing_user_id) do
    original = get_post!(original_post_id)
    dest_space = Repo.get!(Space, destination_space_id)
    source_space = Repo.get!(Space, original.space_id)

    # Validate Echo boundary policy
    allowed? =
      case original.echo_policy do
        "space_only" ->
          false
        "realm_only" ->
          source_space.realm_id != nil and source_space.realm_id == dest_space.realm_id
        "universal" ->
          true
      end

    if allowed? do
      Repo.transaction(fn ->
        echo_attrs = %{
          space_id: destination_space_id,
          author_id: sharing_user_id,
          title: original.title,
          body: original.body,
          echo_policy: original.echo_policy,
          original_post_id: original.id,
          echo_source_space_id: original.space_id,
          published_at: DateTime.utc_now()
        }

        with {:ok, echo_post} <- %Post{} |> Post.changeset(echo_attrs) |> Repo.insert(),
             {1, _} <- from(p in Post, where: p.id == ^original.id) |> Repo.update_all(inc: [echo_count: 1]) do
          echo_post
        else
          {:error, changeset} -> Repo.rollback(changeset)
        end
      end)
    else
      {:error, :echo_policy_violation}
    end
  end

  # Comments
  def list_comments(post_id) do
    from(c in Comment,
      where: c.post_id == ^post_id,
      order_by: [asc: c.inserted_at],
      preload: [:author]
    )
    |> Repo.all()
  end

  def create_comment(attrs \\ %{}) do
    Repo.transaction(fn ->
      with {:ok, comment} <- %Comment{} |> Comment.changeset(attrs) |> Repo.insert(),
           {1, _} <- from(p in Post, where: p.id == ^comment.post_id) |> Repo.update_all(inc: [comment_count: 1]) do
        comment
      else
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end
end
