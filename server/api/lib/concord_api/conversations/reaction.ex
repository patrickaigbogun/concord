defmodule ConcordApi.Conversations.Reaction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [:message_id, :user_id, :emoji, :inserted_at]}

  schema "reactions" do
    belongs_to :message, ConcordApi.Conversations.Message, primary_key: true
    belongs_to :user, ConcordApi.Accounts.User, primary_key: true
    field :emoji, :string, primary_key: true

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(reaction, attrs) do
    reaction
    |> cast(attrs, [:message_id, :user_id, :emoji])
    |> validate_required([:message_id, :user_id, :emoji])
    |> foreign_key_constraint(:message_id)
    |> foreign_key_constraint(:user_id)
  end
end
