defmodule ConcordApi.Realms do
  @moduledoc """
  The Realms context managing Realms and Realm Admissions/Waiting Room.
  """

  import Ecto.Query, warn: false
  alias ConcordApi.Repo
  alias ConcordApi.Realms.{Realm, RealmMember}

  def list_realms do
    Repo.all(Realm)
  end

  def list_user_realms(user_id) do
    from(r in Realm,
      join: rm in RealmMember,
      on: rm.realm_id == r.id,
      where: rm.user_id == ^user_id and rm.status == "admitted",
      select: r
    )
    |> Repo.all()
  end

  def get_realm!(id), do: Repo.get!(Realm, id)
  def get_realm(id), do: Repo.get(Realm, id)

  def get_realm_by_slug(slug) when is_binary(slug) do
    Repo.get_by(Realm, slug: slug)
  end

  def create_realm(attrs \\ %{}, creator_user_id) do
    Repo.transaction(fn ->
      with {:ok, realm} <- %Realm{} |> Realm.changeset(attrs) |> Repo.insert(),
           {:ok, _member} <- %RealmMember{}
                            |> RealmMember.changeset(%{
                              realm_id: realm.id,
                              user_id: creator_user_id,
                              is_curator: true,
                              status: "admitted",
                              admitted_at: DateTime.utc_now()
                            })
                            |> Repo.insert() do
        realm
      else
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  def update_realm(%Realm{} = realm, attrs) do
    realm
    |> Realm.changeset(attrs)
    |> Repo.update()
  end

  def delete_realm(%Realm{} = realm) do
    Repo.delete(realm)
  end

  # Realm Membership & Admissions
  def list_realm_members(realm_id, status \\ nil) do
    query = from rm in RealmMember,
      where: rm.realm_id == ^realm_id,
      preload: [:user]

    query = if status, do: where(query, [rm], rm.status == ^status), else: query

    Repo.all(query)
  end

  def get_realm_member(realm_id, user_id) do
    Repo.get_by(RealmMember, realm_id: realm_id, user_id: user_id)
  end

  def is_realm_curator?(realm_id, user_id) do
    case get_realm_member(realm_id, user_id) do
      %RealmMember{is_curator: true, status: "admitted"} -> true
      _ -> false
    end
  end

  def request_realm_admission(realm_id, user_id) do
    %RealmMember{}
    |> RealmMember.changeset(%{
      realm_id: realm_id,
      user_id: user_id,
      is_curator: false,
      status: "waiting_room"
    })
    |> Repo.insert()
  end

  def admit_member(realm_id, user_id) do
    set_member_status(realm_id, user_id, "admitted")
  end

  def set_member_status(realm_id, user_id, status) when status in ["admitted", "declined"] do
    case get_realm_member(realm_id, user_id) do
      nil -> {:error, :not_found}
      member ->
        attrs = %{status: status}
        attrs = if status == "admitted", do: Map.put(attrs, :admitted_at, DateTime.utc_now()), else: attrs
        member |> RealmMember.changeset(attrs) |> Repo.update()
    end
  end

  # Realm Federation and Rules Agreement for Spaces
  def add_space_to_realm(realm_id, space_id) do
    case Repo.get(ConcordApi.Spaces.Space, space_id) do
      nil -> {:error, :not_found}
      space ->
        space
        |> ConcordApi.Spaces.Space.changeset(%{
          realm_id: realm_id,
          realm_agreement_status: "pending"
        })
        |> Repo.update()
    end
  end

  def agree_to_realm_rules(space_id, agreed_rules) do
    case Repo.get(ConcordApi.Spaces.Space, space_id) do
      nil -> {:error, :not_found}
      space ->
        space
        |> ConcordApi.Spaces.Space.changeset(%{
          realm_agreement_status: "agreed",
          realm_agreed_rules: agreed_rules
        })
        |> Repo.update()
    end
  end
end
