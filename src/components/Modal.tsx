import { useEffect } from "react";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

// Dark dialog over the page. Clicking outside it or pressing Escape closes it.
const Modal: React.FC<ModalProps> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: "520px",
          maxHeight: "100%",
          overflowY: "auto",
          backgroundColor: "rgb(0, 0, 0)",
          color: "rgb(205, 201, 200)",
          border: "1px solid rgb(205, 201, 200)",
          borderRadius: "10px",
          padding: "24px",
          textAlign: "left",
        }}
      >
        <h4>{title}</h4>
        <hr style={{ border: "1px solid white", margin: "10px 0 20px" }} />
        {children}
      </div>
    </div>
  );
};
export default Modal;
