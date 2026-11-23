defmodule ConcordApi.Conversations do
  @moduledoc """
  The Conversations context managing continuous chat messages and reactions.
  """

  import Ecto.Query, warn: false
  alias ConcordApi.Repo
  alias ConcordApi.Conversations.{Message, Reaction}

  def list_messages(space_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    before_id = Keyword.get(opts, :before)
    after_id = Keyword.get(opts, :after)

    query = from m in Message,
      where: m.space_id == ^space_id and is_nil(m.deleted_at),
      order_by: [desc: m.inserted_at],
      limit: ^limit,
      preload: [:author, :reactions]

    query =
      cond do
        before_id ->
          case Repo.get(Message, before_id) do
            %Message{inserted_at: ts} -> where(query, [m], m.inserted_at < ^ts)
            _ -> query
          end
        after_id ->
          case Repo.get(Message, after_id) do
            %Message{inserted_at: ts} -> where(query, [m], m.inserted_at > ^ts)
            _ -> query
          end
        true -> query
      end

    Repo.all(query) |> Enum.reverse()
  end

  def get_message!(id), do: Repo.get!(Message, id) |> Repo.preload([:author, :reactions])
  def get_message(id), do: Repo.get(Message, id) |> Repo.preload([:author, :reactions])

  def create_message(attrs \\ %{}) do
    %Message{}
    |> Message.changeset(attrs)
    |> Repo.insert()
  end

  def create_message(space_id, author_id, attrs) when is_binary(space_id) and is_binary(author_id) do
    attrs
    |> Map.put("space_id", space_id)
    |> Map.put("author_id", author_id)
    |> create_message()
  end

  def update_message(%Message{} = message, attrs) do
    attrs = Map.put(attrs, "edited_at", DateTime.utc_now())
    message
    |> Message.changeset(attrs)
    |> Repo.update()
  end

  def soft_delete_message(%Message{} = message) do
    message
    |> Message.changeset(%{deleted_at: DateTime.utc_now()})
    |> Repo.update()
  end

  # Reactions
  def add_reaction(message_id, user_id, emoji) do
    %Reaction{}
    |> Reaction.changeset(%{
      message_id: message_id,
      user_id: user_id,
      emoji: emoji
    })
    |> Repo.insert(on_conflict: :nothing)
  end

  def remove_reaction(message_id, user_id, emoji) do
    from(r in Reaction,
      where: r.message_id == ^message_id and r.user_id == ^user_id and r.emoji == ^emoji
    )
    |> Repo.delete_all()
  end
end
