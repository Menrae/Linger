import Supercluster from 'supercluster';

export const clusterIndex = new Supercluster({
  radius: 60,
  maxZoom: 14,
  minPoints: 2,
});
