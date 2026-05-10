export type AddressMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type AddressMapPickerProps = {
  visible: boolean;
  region: AddressMapRegion | null;
  line1: string;
  isFetchingAddress: boolean;
  onRegionChangeComplete: (r: AddressMapRegion) => void;
  onConfirm: () => void | Promise<void>;
  /** Back / close without confirming — avoids trapping the user on the map. */
  onClose: () => void;
};
