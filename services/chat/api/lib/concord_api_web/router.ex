defmodule ConcordApiWeb.Router do
  use ConcordApiWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug OpenApiSpex.Plug.PutApiSpec, module: ConcordApiWeb.ApiSpec
  end

  scope "/api" do
    pipe_through :api

    get "/openapi.json", OpenApiSpex.Plug.RenderSpec, []
    get "/swagger", OpenApiSpex.Plug.SwaggerUI, path: "/api/openapi.json"
  end

  scope "/api/v1", ConcordApiWeb do
    pipe_through :api

    # Users
    resources "/users", UserController, only: [:create, :show]
    get "/users/by-username/:username", UserController, :by_username

    # Realms
    resources "/realms", RealmController, only: [:index, :create, :show]
    post "/realms/:id/join", RealmController, :join
    post "/realms/:id/admit", RealmController, :admit
    post "/realms/:id/spaces", RealmController, :add_space
    post "/realms/:id/spaces/:space_id/agree-rules", RealmController, :agree_rules

    # Spaces
    resources "/spaces", SpaceController, only: [:index, :create, :show]
    post "/spaces/:id/join", SpaceController, :join
    put "/spaces/:id/identity", SpaceController, :update_identity

    # Messages (Continuous Chat)
    get "/spaces/:space_id/messages", MessageController, :index
    post "/spaces/:space_id/messages", MessageController, :create
    post "/messages/:id/reactions", MessageController, :add_reaction
    delete "/messages/:id/reactions", MessageController, :remove_reaction

    # Posts, Comments & Echos
    get "/spaces/:space_id/posts", PostController, :index
    post "/spaces/:space_id/posts", PostController, :create
    get "/posts/:id", PostController, :show
    post "/posts/:id/echo", PostController, :echo
    get "/posts/:post_id/comments", PostController, :index_comments
    post "/posts/:post_id/comments", PostController, :create_comment

    # Files & Media views
    get "/spaces/:space_id/files", FileController, :index_files
    get "/spaces/:space_id/media", FileController, :index_media
    post "/spaces/:space_id/files", FileController, :create
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:concord_api, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: ConcordApiWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
