defmodule ConcordApi.Posts.Comment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [
    :id, :post_id, :author_id, :parent_comment_id, :content, :edited_at, :inserted_at
  ]}

  schema "comments" do
    belongs_to :post, ConcordApi.Posts.Post
    belongs_to :author, ConcordApi.Accounts.User
    belongs_to :parent_comment, ConcordApi.Posts.Comment
    field :content, :string
    field :edited_at, :utc_datetime_usec

    has_many :replies, ConcordApi.Posts.Comment, foreign_key: :parent_comment_id

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(comment, attrs) do
    comment
    |> cast(attrs, [:post_id, :author_id, :parent_comment_id, :content, :edited_at])
    |> validate_required([:post_id, :author_id, :content])
    |> foreign_key_constraint(:post_id)
    |> foreign_key_constraint(:author_id)
  end
end
