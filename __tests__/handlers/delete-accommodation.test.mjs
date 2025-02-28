import {DeleteCommand, DynamoDBDocumentClient, ScanCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client, DeleteObjectsCommand} from "@aws-sdk/client-s3";
import {CognitoIdentityProviderClient, GetUserCommand} from "@aws-sdk/client-cognito-identity-provider";
import {mockClient} from "aws-sdk-client-mock";
import {AccommodationService, deleteAccommodationHandler} from "../../src/handlers/delete-accommodation.mjs";

import accommodationItem from "../../mock-items/delete-accommodation/accommodation-item.json" assert { type: "json" };
import userItem from "../../mock-items/delete-accommodation/user-item.json" assert { type: "json" };
import eventItem from "../../events/delete-accommodation/event-item.json" assert { type: "json" };

describe('Test getAllItemsHandler', () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const s3Mock = mockClient(S3Client);
    const cognitoMock = mockClient(CognitoIdentityProviderClient)

    beforeEach(() => {
        ddbMock.reset();
        s3Mock.reset();
        cognitoMock.reset();
    });

    it('should confirm an accommodation and set its values in the class variables', async () => {
        ddbMock.on(ScanCommand).resolves(accommodationItem);

        cognitoMock.on(GetUserCommand).resolves(userItem);

        const service = await new AccommodationService(1, 1);
        expect(service.id).toEqual(1);
        expect(service.hostId).toEqual(1);
        expect(service.images).toEqual(["image1", "image2"]);
    });

    it('should throw an error saying no accommodation was found', async () => {
        expect(async () => await new AccommodationService(1, 1))
            .rejects.toThrow(new Error("Accommodation not found."));
    });

    it('should authorize a delete request', async () => {
        ddbMock.on(ScanCommand).resolves(accommodationItem);

        cognitoMock.on(GetUserCommand).resolves(userItem);

        const service = await new AccommodationService(1, 1);
        expect(async () => await service.authorizeDeleteRequest()).not.toThrow();
    });

    it('should throw an error saying user is not allowed to delete accommodation', async () => {
        ddbMock.on(ScanCommand).resolves(accommodationItem);

        expect(async () => await new AccommodationService(1, 1))
            .rejects.toThrow("You are not allowed to delete this accommodation.");
    });

    it('should delete an accommodation', async () => {
        ddbMock.on(ScanCommand).resolves(accommodationItem);
        ddbMock.on(DeleteCommand).resolves();

        cognitoMock.on(GetUserCommand).resolves(userItem);

        s3Mock.on(DeleteObjectsCommand).resolves();

        const service = await new AccommodationService(1, 1);
        expect(async () => service.delete()).not.toThrow();
    });

    it('should respond with a 200 statuscode and a message indicating successful deletion', async () => {
        ddbMock.on(ScanCommand).resolves(accommodationItem);
        ddbMock.on(DeleteCommand).resolves();

        cognitoMock.on(GetUserCommand).resolves(userItem);

        s3Mock.on(DeleteObjectsCommand).resolves();

        const response = await deleteAccommodationHandler(eventItem);
        expect(response.statusCode).toEqual(200);
        expect(response.body).toEqual('{\"message\":\"Accommodation deleted successfully\"}');
    });

    it('should respond with a 400 statuscode and a message indicating no accommodation was found', async () => {
        const response = await deleteAccommodationHandler(eventItem);
        expect(response.statusCode).toEqual(400);
        expect(response.body).toEqual("Accommodation not found.");
    });

    it('should respond with a 400 statuscode and a message indicating user is not allowed to delete given accommodation',
        async () => {
            ddbMock.on(ScanCommand).resolves(accommodationItem);

            const response = await deleteAccommodationHandler(eventItem);
            expect(response.statusCode).toEqual(400);
            expect(response.body).toEqual("You are not allowed to delete this accommodation.");
        });
});
