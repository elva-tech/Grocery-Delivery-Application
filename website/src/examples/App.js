import LocationPicker from '../components/location/LocationPicker';

const destinationPoints = [
  { id: 'BLR-1', lat: 12.9352, lng: 77.6245 },
  { id: 'BLR-2', lat: 13.0358, lng: 77.597 },
  { id: 'BLR-3', lat: 12.9279, lng: 77.6271 },
];

function App() {
  const handleLocationConfirmed = ({ selectedLocation, response }) => {
    console.log('Confirmed coordinates:', selectedLocation);
    console.log('Backend response:', response);
  };

  return (
    <main style={{ padding: '20px', background: '#fafafa', minHeight: '100vh' }}>
      <LocationPicker
        points={destinationPoints}
        requestConfig={{
          maxDistanceKm: 10,
          enableEligibilityCheck: true,
        }}
        onLocationConfirmed={handleLocationConfirmed}
      />
    </main>
  );
}

export default App;
