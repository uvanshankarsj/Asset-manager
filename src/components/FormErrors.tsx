import type { Errors } from "../validation";

// Lists every problem with a form, so the user sees all of them at once
const FormErrors: React.FC<{ errors: Errors }> = ({ errors }) => {
  const messages = Object.values(errors);
  if (messages.length === 0) return null;
  return (
    <ul role="alert" className="form-errors">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
};
export default FormErrors;
