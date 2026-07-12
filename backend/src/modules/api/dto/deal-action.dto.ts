import { IsString, Matches, IsInt, Min, IsOptional } from 'class-validator';

export class DealActionDto {
  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Invalid phone number format' })
  phone: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
  pin: string;
}

export class RevokeDto extends DealActionDto {
  @IsInt()
  @Min(1, { message: 'Reason code must be at least 1' })
  reasonCode: number;
}

export class ResolveDisputeDto {
  @IsString()
  amountToSender: string;

  @IsString()
  amountToReceiver: string;
}
