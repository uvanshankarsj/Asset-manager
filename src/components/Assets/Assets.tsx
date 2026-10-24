import { useCallback, useEffect, useState } from "react";
import {
  createAsset,
  deleteAsset,
  fetchAssets,
  updateAsset,
  type Asset,
} from "../../api";
import Modal from "../Modal";
import FormErrors from "../FormErrors";
import { useToast } from "../Toast";
import { validateAsset, type Errors } from "../../validation";

const fieldStyle: React.CSSProperties = {
  padding: "10px",
  borderRadius: "5px",
  border: "1px solid rgb(205, 201, 200)",
  backgroundColor: "rgb(40, 39, 39)",
  colorScheme: "dark",
  color: "rgb(205, 201, 200)",
};

const EMPTY = { name: "", price: "", purchaseDate: "" };

const message = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

const Assets: React.FC = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [editErrors, setEditErrors] = useState<Errors>({});
  const [editSaving, setEditSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(
    () =>
      fetchAssets()
        .then(setAssets)
        .catch((err) => toast.error(message(err, "Could not load assets.")))
        .finally(() => setLoading(false)),
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (a: Asset) => {
    setEditing(a);
    setEditErrors({});
    setEditForm({
      name: a.name,
      price: String(a.price),
      purchaseDate: a.purchaseDate.slice(0, 10),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateAsset(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await createAsset({ ...form, name: form.name.trim() });
      setForm(EMPTY);
      await load();
      toast.success("Asset added.");
    } catch (err) {
      toast.error(message(err, "Could not save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const found = validateAsset(editForm);
    setEditErrors(found);
    if (Object.keys(found).length) return;
    setEditSaving(true);
    try {
      await updateAsset(editing._id, editForm);
      setEditing(null);
      await load();
      toast.success("Asset updated.");
    } catch (err) {
      setEditErrors({ save: message(err, "Could not save. Try again.") });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!window.confirm(`Delete "${asset.name}"?`)) return;
    try {
      await deleteAsset(asset._id);
      await load();
      toast.success("Asset deleted.");
    } catch (err) {
      toast.error(message(err, "Could not delete. Please try again."));
    }
  };

  return (
    <div
      className="page"
      style={{
        height: "100vh",
        backgroundColor: "rgb(40, 39, 39)",
        padding: "30px 30px 30px 0px",
      }}
    >
      <div
        className="page-card"
        style={{
          backgroundColor: "rgb(0, 0, 0)",
          height: "100%",
          color: "rgb(205, 201, 200)",
          borderRadius: "20px",
          padding: "3%",
          overflowY: "auto",
        }}
      >
        <h1>Assets</h1>
        <hr style={{ border: "1px solid white", margin: "10px 0" }} />
        <form
          noValidate
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <input
            placeholder="Product name"
            aria-label="Product name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-invalid={!!errors.name}
            style={{ ...fieldStyle, flex: 2, minWidth: "180px" }}
          />
          <input
            type="number"
            min="0"
            step="any"
            placeholder="Price"
            aria-label="Price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            aria-invalid={!!errors.price}
            style={{ ...fieldStyle, flex: 1, minWidth: "110px" }}
          />
          <input
            type="date"
            aria-label="Purchase date"
            value={form.purchaseDate}
            onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            aria-invalid={!!errors.purchaseDate}
            style={{ ...fieldStyle, flex: 1, minWidth: "140px" }}
          />
          <button type="submit" className="btn btn-success" disabled={saving}>
            {saving ? "Adding..." : "Add"}
          </button>
          <div style={{ flexBasis: "100%" }}>
            <FormErrors errors={errors} />
          </div>
        </form>
        <div className="table-responsive">
          <table className="table table-dark" style={{ textAlign: "left" }}>
            <thead>
              <tr>
                <th>Product name</th>
                <th>Price</th>
                <th>Purchase date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4}>Loading...</td>
                </tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan={4}>No assets yet. Add your first one above.</td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr key={a._id}>
                    <td>{a.name}</td>
                    <td>{a.price.toLocaleString()}</td>
                    <td>{new Date(a.purchaseDate).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-light me-2"
                        onClick={() => startEdit(a)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDelete(a)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form noValidate onSubmit={handleEditSubmit}>
            {(
              [
                ["Product name", "name", "text"],
                ["Price", "price", "number"],
                ["Purchase date", "purchaseDate", "date"],
              ] as const
            ).map(([label, key, type]) => (
              <label key={key} style={{ display: "block", marginBottom: "14px" }}>
                <span style={{ display: "block", marginBottom: "4px" }}>
                  {label}
                </span>
                <input
                  type={type}
                  min={type === "number" ? "0" : undefined}
                  step={type === "number" ? "any" : undefined}
                  value={editForm[key]}
                  onChange={(e) =>
                    setEditForm({ ...editForm, [key]: e.target.value })
                  }
                  aria-invalid={!!editErrors[key]}
                  style={{ ...fieldStyle, width: "100%" }}
                />
              </label>
            ))}
            <FormErrors errors={editErrors} />
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
                marginTop: "14px",
              }}
            >
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-success"
                disabled={editSaving}
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Assets;
