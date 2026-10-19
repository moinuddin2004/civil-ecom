// Docker healthcheck for the local MongoDB (see infra/docker-compose.yml).
// First run: initiates replica set "rs0" and exits 1 (not ready yet).
// Later runs: exit 0 once this node is PRIMARY.
//
// The member host is 127.0.0.1:27017 so drivers on the host machine can reach it through the
// published port; inside the container it points at mongod itself.
try {
  const status = rs.status();
  const primary = status.members.some((member) => member.stateStr === 'PRIMARY');
  quit(primary ? 0 : 1);
} catch (error) {
  if (error.codeName === 'NotYetInitialized') {
    rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] });
  }
  quit(1);
}
