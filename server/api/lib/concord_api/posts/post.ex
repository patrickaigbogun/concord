defmodule ConcordApi.Posts.Post do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [
    :id, :space_id, :author_id, :title, :body, :echo_policy,
    :original_post_id, :echo_source_space_id, :echo_count,
    :comment_count, :published_at, :edited_at, :inserted_at
  ]}

  schema "posts" do
    belongs_to :space, ConcordApi.Spaces.Space
    belongs_to :author, ConcordApi.Accounts.User
    belongs_to :original_post, ConcordApi.Posts.Post
    belongs_to :echo_source_space, ConcordApi.Spaces.Space

    field :title, :string
    field :body, :string
    field :echo_policy, :string, default: "universal" # space_only | realm_only | universal
    field :echo_count, :integer, default: 0
    field :comment_count, :integer, default: 0
    field :published_at, :utc_datetime_usec
    field :edited_at, :utc_datetime_usec

    has_many :comments, ConcordApi.Posts.Comment

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(post, attrs) do
    post
    |> cast(attrs, [
      :space_id, :author_id, :title, :body, :echo_policy,
      :original_post_id, :echo_source_space_id, :echo_count,
      :comment_count, :published_at, :edited_at
    ])
    |> validate_required([:space_id, :author_id, :title, :body, :published_at])
    |> validate_inclusion(:echo_policy, ["space_only", "realm_only", "universal"])
    |> foreign_key_constraint(:space_id)
    |> foreign_key_constraint(:author_id)
  end
end
