export default function authHeader(headers = '') {
  // return authorization header with jwt token
  const user = JSON.parse(localStorage.getItem('user'));
  if (user && user.jwtToken) {
    if (headers === 'json') {
      return new Headers({
        Authorization: `Bearer ${user.jwtToken ? user.jwtToken : ''}`,
        'Content-Type': 'application/json',
      });
    } else if (headers === 'form-data') {
      return new Headers({
        Authorization: `Bearer ${user.jwtToken ? user.jwtToken : ''}`,
        'Content-Type': 'multipart/form-data',
      });
    }
    return {
      Authorization: `Bearer ${user.jwtToken ? user.jwtToken : ''}`,
    };
  }
  return {};
}
