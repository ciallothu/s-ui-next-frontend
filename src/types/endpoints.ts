import { Dial } from "./dial"

export const EpTypes = {
  Wireguard: 'wireguard',
  Warp: 'warp',
  Tailscale: 'tailscale',
}

type EpType = typeof EpTypes[keyof typeof EpTypes]

interface EndpointBasics {
  id: number
  type: EpType
  tag: string
}

export interface WgPeer {
  name?: string
  peer_mode?: 'roaming_client' | 'static_peer' | 'site_to_site'
  address?: string
  port?: number
  static_remote_address?: string
  static_remote_port?: number
  public_key: string
  pre_shared_key?: string
  allowed_ips?: string[]
  server_allowed_ips?: string[]
  assigned_ipv4?: string
  assigned_ipv6?: string
  client_private_key?: string
  client_private_key_set?: boolean
  client_allowed_ips?: string[]
  client_dns?: string[]
  client_mtu?: number
  client_keepalive?: number
  client_route_preset?: 'virtual_network' | 'single_peer' | 'custom' | 'full_tunnel'
  include_ipv4?: boolean
  include_ipv6?: boolean
  persistent_keepalive_interval?: number
  reserved?: number[]
}

export interface WireGuard extends EndpointBasics, Dial {
  wireguard_schema?: number
  system?: boolean
  name?: string
  mtu?: number
  address: string[]
  private_key: string
  listen_port: number
  tunnel_ipv4_cidr?: string
  tunnel_ipv6_cidr?: string
  advertised_endpoint_host?: string
  advertised_endpoint_port?: number
  peer_to_peer_enabled?: boolean
  default_client_allowed_ips?: string[]
  default_client_dns?: string[]
  default_client_mtu?: number
  default_client_keepalive?: number
  peers: WgPeer[]
  udp_timeout?: string
  workers?: number
  ext: any
}

export interface Warp extends WireGuard {}

export interface Tailscale extends EndpointBasics, Dial {
  state_directory?: string
  auth_key?: string
  control_url?: string
  ephemeral?: boolean
  hostname?: string
  accept_routes?: boolean
  exit_node?: string
  exit_node_allow_lan_access?: boolean
  advertise_routes?: string[]
  advertise_exit_node?: boolean
  relay_server_port?: number
  relay_server_static_endpoints?: string[]
  system_interface?: boolean
  system_interface_name?: string
  system_interface_mtu?: number
  udp_timeout?: string
}

// Create interfaces dynamically based on EpTypes keys
type InterfaceMap = {
  [Key in keyof typeof EpTypes]: {
    type: string
    [otherProperties: string]: any // You can add other properties as needed
  }
}

// Create union type from InterfaceMap
export type Endpoint = InterfaceMap[keyof InterfaceMap]

// Create defaultValues object dynamically
const defaultValues: Record<EpType, Endpoint> = {
  wireguard: {
    type: EpTypes.Wireguard,
    wireguard_schema: 2,
    address: ['10.66.66.1/32', 'fd66:66:66::1/128'],
    tunnel_ipv4_cidr: '10.66.66.0/24',
    tunnel_ipv6_cidr: 'fd66:66:66::/64',
    advertised_endpoint_host: '',
    advertised_endpoint_port: 0,
    peer_to_peer_enabled: false,
    default_client_allowed_ips: ['10.66.66.0/24', 'fd66:66:66::/64'],
    default_client_dns: [],
    default_client_mtu: 1420,
    default_client_keepalive: 25,
    system: false,
    private_key: '',
    listen_port: 0,
    peers: [],
    ext: { keys: [] },
  },
  warp: { type: EpTypes.Warp, address: [], private_key: '', listen_port: 0, mtu: 1420, peers: [{ address: '', port: 0, public_key: ''}] },
  tailscale: { type: EpTypes.Tailscale, domain_resolver: 'local' },
}

export function createEndpoint<T extends Endpoint>(type: string,json?: Partial<T>): Endpoint {
  const defaultObject: Endpoint = { ...defaultValues[type], ...(json || {}) }
  return defaultObject
}
