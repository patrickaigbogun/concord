defmodule ConcordApi.Application do
  # See https://elixir.hexdocs.pm/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      ConcordApiWeb.Telemetry,
      ConcordApi.Repo,
      {DNSCluster, query: Application.get_env(:concord_api, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ConcordApi.PubSub},
      # Start a worker by calling: ConcordApi.Worker.start_link(arg)
      # {ConcordApi.Worker, arg},
      # Start to serve requests, typically the last entry
      ConcordApiWeb.Endpoint
    ]

    # See https://elixir.hexdocs.pm/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ConcordApi.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ConcordApiWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
