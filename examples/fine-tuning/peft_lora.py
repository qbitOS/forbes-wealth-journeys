"""PEFT/LoRA fine-tuning stub."""

def train(config_path: str) -> None:
    print(f"[fine-tuning] peft_lora config={config_path}")


if __name__ == "__main__":
    train("examples/fine-tuning/configs/finetune.yaml")
