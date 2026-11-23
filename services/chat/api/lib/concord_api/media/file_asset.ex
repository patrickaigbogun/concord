defmodule ConcordApi.Media.FileAsset do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id
  @derive {Jason.Encoder, only: [
    :id, :space_id, :uploader_id, :filename, :content_type,
    :size_bytes, :url, :preview_url, :metadata, :inserted_at
  ]}

  schema "file_assets" do
    belongs_to :space, ConcordApi.Spaces.Space
    belongs_to :uploader, ConcordApi.Accounts.User
    field :filename, :string
    field :content_type, :string
    field :size_bytes, :integer
    field :url, :string
    field :preview_url, :string
    field :metadata, :map, default: %{}

    timestamps(type: :utc_datetime_usec)
  end

  @doc false
  def changeset(file_asset, attrs) do
    file_asset
    |> cast(attrs, [:space_id, :uploader_id, :filename, :content_type, :size_bytes, :url, :preview_url, :metadata])
    |> validate_required([:space_id, :uploader_id, :filename, :content_type, :size_bytes, :url])
    |> foreign_key_constraint(:space_id)
    |> foreign_key_constraint(:uploader_id)
  end
end
