defmodule ConcordApi.Spaces do
  @moduledoc """
  The Spaces context managing Spaces, Space Membership, and Contextual Personas/Tags.
  """

  import Ecto.Query, warn: false
  alias ConcordApi.Repo
  alias ConcordApi.Spaces.{Space, SpaceMember}

  def list_spaces do
    Repo.all(Space)
  end

  def list_user_spaces(user_id) do
    from(s in Space,
      join: sm in SpaceMember,
      on: sm.space_id == s.id,
      where: sm.user_id == ^user_id,
      select: s
    )
    |> Repo.all()
  end

  def list_realm_spaces(realm_id) do
    from(s in Space, where: s.realm_id == ^realm_id)
    |> Repo.all()
  end

  def get_space!(id), do: Repo.get!(Space, id)
  def get_space(id), do: Repo.get(Space, id)

  def create_space(attrs \\ %{}, creator_user_id, creator_tag \\ nil) do
    Repo.transaction(fn ->
      with {:ok, space} <- %Space{} |> Space.changeset(attrs) |> Repo.insert(),
           {:ok, _member} <- %SpaceMember{}
                            |> SpaceMember.changeset(%{
                              space_id: space.id,
                              user_id: creator_user_id,
                              tag: creator_tag,
                              is_curator: true,
                              joined_at: DateTime.utc_now()
                            })
                            |> Repo.insert() do
        space
      else
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  def update_space(%Space{} = space, attrs) do
    space
    |> Space.changeset(attrs)
    |> Repo.update()
  end

  def delete_space(%Space{} = space) do
    Repo.delete(space)
  end

  # Space Members & Contextual Identity
  def list_space_members(space_id) do
    from(sm in SpaceMember,
      where: sm.space_id == ^space_id,
      preload: [:user]
    )
    |> Repo.all()
  end

  def get_space_member(space_id, user_id) do
    Repo.get_by(SpaceMember, space_id: space_id, user_id: user_id)
  end

  def is_space_curator?(space_id, user_id) do
    case get_space_member(space_id, user_id) do
      %SpaceMember{is_curator: true} -> true
      _ -> false
    end
  end

  def join_space(space_id, user_id, tag \\ nil) do
    %SpaceMember{}
    |> SpaceMember.changeset(%{
      space_id: space_id,
      user_id: user_id,
      tag: tag,
      is_curator: false,
      joined_at: DateTime.utc_now()
    })
    |> Repo.insert()
  end

  def update_contextual_identity(space_id, user_id, attrs) do
    case get_space_member(space_id, user_id) do
      nil -> {:error, :not_found}
      member ->
        member
        |> SpaceMember.changeset(attrs)
        |> Repo.update()
    end
  end

  # Realm Agreement
  def submit_realm_agreement(%Space{} = space, status, agreed_rules) when status in ["agreed", "rejected"] do
    space
    |> Space.changeset(%{
      realm_agreement_status: status,
      realm_agreed_rules: agreed_rules
    })
    |> Repo.update()
  end
end
