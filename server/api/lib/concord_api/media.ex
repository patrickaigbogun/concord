defmodule ConcordApi.Media do
  @moduledoc """
  The Media context managing files, documents, and media gallery views.
  """

  import Ecto.Query, warn: false
  alias ConcordApi.Repo
  alias ConcordApi.Media.FileAsset

  def list_files(space_id) do
    from(f in FileAsset,
      where: f.space_id == ^space_id and not like(f.content_type, "image/%") and not like(f.content_type, "video/%"),
      order_by: [desc: f.inserted_at],
      preload: [:uploader]
    )
    |> Repo.all()
  end

  def list_media(space_id) do
    from(f in FileAsset,
      where: f.space_id == ^space_id and (like(f.content_type, "image/%") or like(f.content_type, "video/%")),
      order_by: [desc: f.inserted_at],
      preload: [:uploader]
    )
    |> Repo.all()
  end

  def create_file_asset(attrs \\ %{}) do
    %FileAsset{}
    |> FileAsset.changeset(attrs)
    |> Repo.insert()
  end
end
