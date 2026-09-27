defmodule ConcordApi.Conversations.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [
    :id, :space_id, :author_id, :content, :reply_to_id,
    :type, :edited_at, :deleted_at, :inserted_at
  ]}

  schema "messages" do
    belongs_to :space, ConcordApi.Spaces.Space
    belongs_to :author, ConcordApi.Accounts.User
    belongs_to :reply_to, ConcordApi.Conversations.Message
    field :content, :string
    field :type, :string, default: "text" # text | file | media | system
    field :edited_at, :utc_datetime_usec
    field :deleted_at, :utc_datetime_usec

    has_many :reactions, ConcordApi.Conversations.Reaction

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(message, attrs) do
    message
    |> cast(attrs, [:space_id, :author_id, :content, :reply_to_id, :type, :edited_at, :deleted_at])
    |> validate_required([:space_id, :author_id, :content])
    |> validate_inclusion(:type, ["text", "file", "media", "system"])
    |> foreign_key_constraint(:space_id)
    |> foreign_key_constraint(:author_id)
  end
end
