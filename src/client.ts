type TripItClient = {
  authenticate(): Promise<string>;
  getAccessToken(): string;
  listTrips(pageSize?: number, pageNum?: number, past?: boolean): Promise<unknown>;
  getTrip(id: string): Promise<unknown>;
  createTrip(params: {
    displayName: string;
    startDate: string;
    endDate: string;
    primaryLocation?: string;
  }): Promise<unknown>;
  updateTrip(params: {
    id: string;
    displayName?: string;
    startDate?: string;
    endDate?: string;
    primaryLocation?: string;
    description?: string;
  }): Promise<unknown>;
  deleteTrip(id: string): Promise<unknown>;
  getHotel(id: string): Promise<unknown>;
  createHotel(params: Record<string, unknown>): Promise<unknown>;
  updateHotel(params: Record<string, unknown>): Promise<unknown>;
  deleteHotel(id: string): Promise<unknown>;
  getFlight(id: string): Promise<unknown>;
  createFlight(params: Record<string, unknown>): Promise<unknown>;
  updateFlight(params: Record<string, unknown>): Promise<unknown>;
  deleteFlight(id: string): Promise<unknown>;
  getTransport(id: string): Promise<unknown>;
  createTransport(params: Record<string, unknown>): Promise<unknown>;
  updateTransport(params: Record<string, unknown>): Promise<unknown>;
  deleteTransport(id: string): Promise<unknown>;
  getActivity(id: string): Promise<unknown>;
  createActivity(params: Record<string, unknown>): Promise<unknown>;
  updateActivity(params: Record<string, unknown>): Promise<unknown>;
  deleteActivity(id: string): Promise<unknown>;
  attachDocument(params: Record<string, unknown>): Promise<unknown>;
  removeDocument(params: Record<string, unknown>): Promise<unknown>;
};

type TripItConstructor = new (config: {
  clientId?: string;
  username: string;
  password: string;
}) => TripItClient;

async function loadTripItConstructor(): Promise<TripItConstructor> {
  const module = (await import("tripit")) as unknown as {
    TripIt?: TripItConstructor;
    default?: TripItConstructor;
  };

  const TripIt = module.TripIt ?? module.default;
  if (!TripIt) {
    throw new Error("Could not load the TripIt client constructor from the tripit package.");
  }

  return TripIt;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export async function createAuthenticatedTripItClient(): Promise<TripItClient> {
  const TripIt = await loadTripItConstructor();
  const client = new TripIt({
    username: requiredEnv("TRIPIT_USERNAME"),
    password: requiredEnv("TRIPIT_PASSWORD"),
    clientId: optionalEnv("TRIPIT_CLIENT_ID"),
  });

  await client.authenticate();
  return client;
}

export async function withTripIt<T>(callback: (client: TripItClient) => Promise<T>): Promise<T> {
  const client = await createAuthenticatedTripItClient();
  return callback(client);
}
