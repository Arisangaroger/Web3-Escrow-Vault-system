import { IsString, IsNotEmpty, Matches, IsNumberString } from 'class-validator';

export class CreateDealDto {
  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Invalid phone number format' })
  senderPhone: string;

  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Invalid phone number format' })
  driverPhone: string;

  @IsString()
  @Matches(/^\+?\d+$/, { message: 'Invalid phone number format' })
  receiverPhone: string;

  @IsNumberString({}, { message: 'Amount must be a valid number' })
  @IsNotEmpty()
  amount: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be 4 digits' })
  pin: string;
}
