import { useRef, useState } from "react";
import { removeAvatar, updateAvatar, type AuthUser } from "../api";

const SIZE = 256;

// Crops to a centred square and shrinks to a small JPEG so it is cheap to store with the account
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      canvas
        .getContext("2d")!
        .drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          SIZE,
          SIZE
        );
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not an image."));
    };
    img.src = url;
  });
}

type ProfileProps = {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
};

function Profile({ user, onUserChange }: ProfileProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<AuthUser>) => {
    setError("");
    setBusy(true);
    try {
      onUserChange(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update photo.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (file) run(async () => updateAvatar(await resizeImage(file)));
  };

  const circle = {
    width: "100px",
    height: "100px",
    margin: "20px auto 10px",
    display: "flex",
  };

  return (
    <>
      {user.avatar ? (
        <img
          src={user.avatar}
          alt="profile image"
          className="sidebar-avatar rounded-circle border border-white border-5"
          style={{ ...circle, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          className="sidebar-avatar rounded-circle border border-white border-5 align-items-center justify-content-center"
          style={{
            ...circle,
            fontSize: "40px",
            color: "white",
            backgroundColor: "rgb(4, 115, 117)",
          }}
          aria-label="profile image"
        >
          {user.name.trim().charAt(0).toUpperCase()}
        </div>
      )}
      <h4 style={{ color: "rgb(205, 201, 200)", marginBottom: "5px" }}>
        {user.name}
      </h4>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={onFile}
      />
      <div style={{ marginBottom: "20px" }}>
        <button
          className="btn btn-link btn-sm p-0 text-info"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? "Saving..." : "Change photo"}
        </button>
        {user.avatar && !busy && (
          <button
            className="btn btn-link btn-sm p-0 ms-3 text-secondary"
            onClick={() => run(removeAvatar)}
          >
            Remove
          </button>
        )}
        {error && <div className="small text-danger">{error}</div>}
      </div>
    </>
  );
}
export default Profile;
