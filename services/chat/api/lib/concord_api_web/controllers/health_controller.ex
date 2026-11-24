defmodule ConcordApiWeb.HealthController do
  use ConcordApiWeb, :controller

  def index(conn, _params) do
    json(conn, %{status: "ok", service: "concord-chat"})
  end
end
