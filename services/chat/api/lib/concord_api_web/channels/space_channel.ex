defmodule ConcordApiWeb.SpaceChannel do
  use ConcordApiWeb, :channel

  alias ConcordApi.Conversations
  alias ConcordApi.Posts
  alias ConcordApi.Spaces

  @impl true
  def join("space:" <> space_id, _payload, socket) do
    case Spaces.get_space(space_id) do
      nil ->
        {:error, %{reason: "Space not found"}}

      _space ->
        socket = assign(socket, :space_id, space_id)
        {:ok, %{status: "connected", space_id: space_id}, socket}
    end
  end

  @impl true
  def handle_in("new_message", payload, socket) do
    space_id = socket.assigns.space_id
    user_id = socket.assigns[:user_id] || payload["user_id"]

    if user_id do
      case Conversations.create_message(space_id, user_id, payload) do
        {:ok, message} ->
          broadcast!(socket, "message_created", %{
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
          {:reply, {:ok, %{id: message.id}}, socket}

        {:error, changeset} ->
          {:reply, {:error, %{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)}}, socket}
      end
    else
      {:reply, {:error, %{reason: "Unauthorized: Missing user_id"}}, socket}
    end
  end

  def handle_in("add_reaction", %{"message_id" => message_id, "emoji" => emoji} = payload, socket) do
    user_id = socket.assigns[:user_id] || payload["user_id"]

    if user_id do
      case Conversations.add_reaction(message_id, user_id, emoji) do
        {:ok, reaction} ->
          broadcast!(socket, "reaction_added", %{
            id: reaction.id,
            message_id: reaction.message_id,
            user_id: reaction.user_id,
            emoji: reaction.emoji
          })
          {:reply, {:ok, %{id: reaction.id}}, socket}

        {:error, changeset} ->
          {:reply, {:error, %{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)}}, socket}
      end
    else
      {:reply, {:error, %{reason: "Unauthorized: Missing user_id"}}, socket}
    end
  end

  def handle_in("typing", payload, socket) do
    user_id = socket.assigns[:user_id] || payload["user_id"]
    broadcast_from!(socket, "user_typing", %{
      user_id: user_id,
      username: payload["username"] || "Someone",
      typing: payload["typing"] != false
    })
    {:noreply, socket}
  end

  def handle_in("new_post", payload, socket) do
    space_id = socket.assigns.space_id
    user_id = socket.assigns[:user_id] || payload["user_id"]

    if user_id do
      case Posts.create_post(space_id, user_id, payload) do
        {:ok, post} ->
          broadcast!(socket, "post_published", %{
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
          {:reply, {:ok, %{id: post.id}}, socket}

        {:error, changeset} ->
          {:reply, {:error, %{errors: Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)}}, socket}
      end
    else
      {:reply, {:error, %{reason: "Unauthorized: Missing user_id"}}, socket}
    end
  end

  def handle_in("echo_post", %{"post_id" => post_id, "target_space_id" => target_space_id} = payload, socket) do
    user_id = socket.assigns[:user_id] || payload["user_id"]

    if user_id do
      case Posts.echo_post(post_id, target_space_id, user_id) do
        {:ok, echoed_post} ->
          # Broadcast to current space and target space
          ConcordApiWeb.Endpoint.broadcast!("space:#{target_space_id}", "post_echoed", %{
            id: echoed_post.id,
            space_id: echoed_post.space_id,
            original_post_id: echoed_post.original_post_id,
            echo_source_space_id: echoed_post.echo_source_space_id,
            title: echoed_post.title,
            author: echoed_post.author && %{
              id: echoed_post.author.id,
              username: echoed_post.author.username,
              display_name: echoed_post.author.display_name
            }
          })
          {:reply, {:ok, %{id: echoed_post.id}}, socket}

        {:error, reason} ->
          {:reply, {:error, %{reason: reason}}, socket}
      end
    else
      {:reply, {:error, %{reason: "Unauthorized: Missing user_id"}}, socket}
    end
  end
end
