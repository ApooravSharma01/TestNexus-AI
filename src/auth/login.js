export function login(user) {
  if (!user) {
    throw new Error("missing user");
  }

  return user;
}
