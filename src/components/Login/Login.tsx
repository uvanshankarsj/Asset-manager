import { useState } from "react";
import { login, register, type AuthUser } from "../../api";

type LoginProps = {
  onAuthenticated: (token: string, user: AuthUser) => void;
};

export const Login = ({ onAuthenticated }: LoginProps) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  const switchMode = () => {
    setMode(isRegister ? "login" : "register");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user } = isRegister
        ? await register(name, email, password)
        : await login(email, password);
      onAuthenticated(token, user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: "100vh", backgroundColor: "rgb(40, 39, 39)" }}
    >
      <form
        onSubmit={submit}
        className="card p-4 shadow"
        style={{ width: "100%", maxWidth: "400px" }}
      >
        <h3 className="mb-1">Asset Manager</h3>
        <p className="text-muted mb-4">
          {isRegister ? "Create your account" : "Log in to continue"}
        </p>

        {error && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}

        {isRegister && (
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              Name
            </label>
            <input
              id="name"
              className="form-control"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>
        )}

        <div className="mb-3">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="form-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            minLength={isRegister ? 8 : undefined}
            required
          />
          {isRegister && (
            <div className="form-text">At least 8 characters.</div>
          )}
        </div>

        <button type="submit" className="btn btn-primary w-100" disabled={busy}>
          {busy ? "Please wait..." : isRegister ? "Sign up" : "Log in"}
        </button>

        <button
          type="button"
          className="btn btn-link mt-2"
          onClick={switchMode}
        >
          {isRegister
            ? "Already have an account? Log in"
            : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
};
export default Login;
