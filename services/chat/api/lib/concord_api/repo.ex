defmodule ConcordApi.Repo do
  use Ecto.Repo,
    otp_app: :concord_api,
    adapter: Ecto.Adapters.Postgres
end
