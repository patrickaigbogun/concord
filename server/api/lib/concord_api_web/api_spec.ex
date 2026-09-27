defmodule ConcordApiWeb.ApiSpec do
  @moduledoc """
  OpenAPI 3.0 Document Specification for Concord.
  """
  alias OpenApiSpex.{OpenApi, Info, Server, Paths}

  @behaviour OpenApi

  @impl OpenApi
  def spec do
    %OpenApi{
      servers: [
        Server.from_endpoint(ConcordApiWeb.Endpoint)
      ],
      info: %Info{
        title: "Concord API",
        version: "1.0.0",
        description: "Stateless REST API for Concord — a writing- and discussion-centric messaging platform."
      },
      paths: Paths.from_router(ConcordApiWeb.Router)
    }
    |> OpenApiSpex.resolve_schema_modules()
  end
end
